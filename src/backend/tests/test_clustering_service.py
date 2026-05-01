"""
test_clustering_service.py
时空聚类服务单元测试

覆盖：
  - _haversine_m         地理距离计算
  - _cosine_sim          余弦相似度
  - _compute_severity    病害严重等级初评
  - _time_bonus          时间衰减加分
  - assign_cluster       主入口：无 GPS / 假坐标 / 近距离 / 远距离 / 视觉 ReID / 类型差异化阈值
"""

import math
import sys
import types
from datetime import datetime, timedelta, timezone
from typing import Optional
from unittest.mock import MagicMock, patch

import pytest

# ── 隔离导入（不依赖 app.db 等重型依赖） ──────────────────────────────────────
_sa_mod = types.ModuleType("sqlalchemy")
_sa_mod.text = lambda s: s
_sa_mod.or_ = MagicMock(return_value=MagicMock())
_sa_mod.Column = MagicMock()
_sa_mod.String = MagicMock()
_sa_mod.Integer = MagicMock()
_sa_mod.Float = MagicMock()
_sa_mod.Boolean = MagicMock()
_sa_mod.DateTime = MagicMock()
_sa_mod.JSON = MagicMock()
_sa_mod.ForeignKey = MagicMock()
_sa_mod.func = MagicMock()
sys.modules.setdefault("sqlalchemy", _sa_mod)

_sa_orm = types.ModuleType("sqlalchemy.orm")
_sa_orm.Session = MagicMock()
_sa_orm.relationship = MagicMock()
_sa_orm.DeclarativeBase = MagicMock()
_sa_orm.declared_attr = MagicMock()
sys.modules.setdefault("sqlalchemy.orm", _sa_orm)

sys.modules.setdefault("sqlalchemy.ext", types.ModuleType("sqlalchemy.ext"))
sys.modules.setdefault("sqlalchemy.ext.declarative", MagicMock())

_models_mod = types.ModuleType("app.db.models")


def _mock_column():
    """创建支持 SQLAlchemy 过滤链式调用的列 mock。"""
    m = MagicMock()
    m.is_ = MagicMock(return_value=m)
    m.isnot = MagicMock(return_value=m)
    m.notin_ = MagicMock(return_value=m)
    m.between = MagicMock(return_value=m)
    m.__eq__ = MagicMock(return_value=m)
    return m


class _FakeDiseaseRecord:
    feature_vector = _mock_column()
    timestamp = _mock_column()
    cluster_id = _mock_column()
    deleted_at = _mock_column()


class _FakeDiseaseCluster:
    cluster_id = _mock_column()
    label_cn = _mock_column()
    canonical_lat = _mock_column()
    canonical_lng = _mock_column()
    status = _mock_column()
    detection_count = _mock_column()
    last_detected_at = _mock_column()
    deleted_at = _mock_column()


_models_mod.DiseaseRecord = _FakeDiseaseRecord
_models_mod.DiseaseCluster = _FakeDiseaseCluster
sys.modules["app"] = types.ModuleType("app")
sys.modules["app.db"] = types.ModuleType("app.db")
sys.modules["app.db.models"] = _models_mod

import importlib.util
import os

_svc_path = os.path.join(
    os.path.dirname(__file__), "..", "app", "services", "clustering_service.py"
)
_spec = importlib.util.spec_from_file_location("clustering_service", _svc_path)
_svc = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_svc)

_haversine_m      = _svc._haversine_m
_cosine_sim       = _svc._cosine_sim
_compute_severity = _svc._compute_severity
_time_bonus       = _svc._time_bonus
assign_cluster    = _svc.assign_cluster

SPATIAL_THRESHOLD_M = _svc.SPATIAL_THRESHOLD_M
SPATIAL_RELAXED_M   = _svc.SPATIAL_RELAXED_M
MERGE_THRESHOLD     = _svc.MERGE_THRESHOLD
VISUAL_STRONG       = _svc.VISUAL_STRONG
VISUAL_WEAK         = _svc.VISUAL_WEAK
ALPHA               = _svc.ALPHA
BETA                = _svc.BETA
_TIME_BONUS_MAX     = _svc._TIME_BONUS_MAX
_TIME_FRESH_DAYS    = _svc._TIME_FRESH_DAYS
_TIME_DECAY_DAYS    = _svc._TIME_DECAY_DAYS
_LABEL_THRESHOLDS   = _svc._LABEL_THRESHOLDS
CANDIDATE_RADIUS_M  = _svc.CANDIDATE_RADIUS_M


# ════════════════════════════════════════════════════════════════════════════
# _haversine_m
# ════════════════════════════════════════════════════════════════════════════

class TestHaversine:
    def test_same_point_is_zero(self):
        assert _haversine_m(31.0, 121.0, 31.0, 121.0) == pytest.approx(0.0, abs=1e-6)

    def test_one_degree_latitude_approx_111km(self):
        d = _haversine_m(0.0, 0.0, 1.0, 0.0)
        assert 110_000 < d < 112_000

    def test_short_distance_accuracy(self):
        lat1, lng1 = 39.9055, 116.3976
        lat2 = lat1 + 100 / 111_111.0
        d = _haversine_m(lat1, lng1, lat2, lng1)
        assert d == pytest.approx(100.0, rel=0.02)

    def test_symmetric(self):
        d1 = _haversine_m(31.0, 121.0, 31.005, 121.005)
        d2 = _haversine_m(31.005, 121.005, 31.0, 121.0)
        assert d1 == pytest.approx(d2, rel=1e-9)

    def test_5m_delta_accuracy(self):
        lat1, lng1 = 31.23, 121.47
        delta_lat = 5.0 / 111_111.0
        d = _haversine_m(lat1, lng1, lat1 + delta_lat, lng1)
        assert d == pytest.approx(5.0, rel=0.02)


# ════════════════════════════════════════════════════════════════════════════
# _cosine_sim
# ════════════════════════════════════════════════════════════════════════════

class TestCosineSim:
    def test_identical_vectors_return_one(self):
        v = [1.0, 2.0, 3.0]
        assert _cosine_sim(v, v) == pytest.approx(1.0, abs=1e-6)

    def test_orthogonal_vectors_return_zero(self):
        assert _cosine_sim([1, 0, 0], [0, 1, 0]) == pytest.approx(0.0, abs=1e-6)

    def test_opposite_vectors_clipped_to_zero(self):
        assert _cosine_sim([1, 0], [-1, 0]) == pytest.approx(0.0, abs=1e-6)

    def test_shape_mismatch_returns_zero(self):
        assert _cosine_sim([1, 2, 3], [1, 2]) == pytest.approx(0.0)

    def test_zero_vector_returns_zero(self):
        assert _cosine_sim([0, 0, 0], [1, 2, 3]) == pytest.approx(0.0)

    def test_partial_similarity(self):
        v1, v2 = [1.0, 0.0], [1.0, 1.0]
        expected = 1.0 / math.sqrt(2.0)
        assert _cosine_sim(v1, v2) == pytest.approx(expected, abs=1e-6)

    def test_32dim_identical_histogram(self):
        import numpy as np
        hist = list(np.ones(32).tolist())
        assert _cosine_sim(hist, hist) == pytest.approx(1.0, abs=1e-5)


# ════════════════════════════════════════════════════════════════════════════
# _compute_severity
# ════════════════════════════════════════════════════════════════════════════

class TestComputeSeverity:
    def test_returns_in_range_1_to_5(self):
        for conf in [0.0, 0.3, 0.6, 0.9, 1.0]:
            s = _compute_severity(conf, None)
            assert 1 <= s <= 5

    def test_high_conf_no_bbox_gives_3(self):
        # 0.6*1 + 0.4*0 = 0.6 → round(3.0) = 3
        assert _compute_severity(1.0, None) == 3

    def test_large_bbox_increases_severity(self):
        bbox = [0, 0, 250, 200]  # area=50000 → area_score=1.0
        s_no_bbox = _compute_severity(0.0, None)
        s_with_bbox = _compute_severity(0.0, bbox)
        assert s_with_bbox >= s_no_bbox

    def test_none_confidence_gives_1(self):
        assert _compute_severity(None, None) == 1

    def test_full_score_gives_5(self):
        bbox = [0, 0, 250, 200]
        assert _compute_severity(1.0, bbox) == 5

    def test_invalid_bbox_falls_back_gracefully(self):
        s = _compute_severity(0.8, ["a", "b", "c", "d"])
        assert 1 <= s <= 5


# ════════════════════════════════════════════════════════════════════════════
# _time_bonus
# ════════════════════════════════════════════════════════════════════════════

class TestTimeBonus:
    def _ago(self, days: float) -> datetime:
        return datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=days)

    def test_none_returns_zero(self):
        assert _time_bonus(None) == 0.0

    def test_fresh_detection_returns_max(self):
        assert _time_bonus(self._ago(0.5)) == pytest.approx(_TIME_BONUS_MAX)

    def test_at_fresh_boundary_returns_max(self):
        assert _time_bonus(self._ago(_TIME_FRESH_DAYS)) == pytest.approx(_TIME_BONUS_MAX)

    def test_old_detection_returns_zero(self):
        assert _time_bonus(self._ago(_TIME_DECAY_DAYS + 1)) == 0.0

    def test_at_decay_boundary_returns_zero(self):
        assert _time_bonus(self._ago(_TIME_DECAY_DAYS)) == 0.0

    def test_midpoint_is_half_max(self):
        mid = (_TIME_FRESH_DAYS + _TIME_DECAY_DAYS) / 2.0
        bonus = _time_bonus(self._ago(mid))
        assert bonus == pytest.approx(_TIME_BONUS_MAX * 0.5, rel=0.05)

    def test_monotonically_decreasing(self):
        days_seq = [0.5, 2.0, 5.0, 8.0, 10.0, 13.9, 15.0]
        bonuses = [_time_bonus(self._ago(d)) for d in days_seq]
        for i in range(len(bonuses) - 1):
            assert bonuses[i] >= bonuses[i + 1], f"not monotone at index {i}"

    def test_timezone_aware_datetime_is_supported(self):
        aware_dt = datetime.now(timezone.utc) - timedelta(days=1)
        assert _time_bonus(aware_dt) == pytest.approx(_TIME_BONUS_MAX)


# ════════════════════════════════════════════════════════════════════════════
# assign_cluster —— Mock Session
# ════════════════════════════════════════════════════════════════════════════

def _make_cluster_mock(
    cluster_id="c1",
    lat=31.23,
    lng=121.47,
    detection_count=2,
    days_ago=1.0,
    feature_vector=None,
):
    cl = MagicMock()
    cl.cluster_id = cluster_id
    cl.canonical_lat = lat
    cl.canonical_lng = lng
    cl.detection_count = detection_count
    cl.last_detected_at = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=days_ago)
    cl.status = "pending"
    cl.deleted_at = None
    return cl


def _make_db_no_postgis(cluster_list=None, fv=None):
    """构造无 PostGIS 的 mock Session，cluster_list 为 ORM 候选列表。"""
    _svc._postgis_available = None  # 每次测试重置缓存

    db = MagicMock()
    db.execute.side_effect = Exception("no postgis")

    mock_q = MagicMock()
    mock_q.filter.return_value = mock_q
    mock_q.order_by.return_value = mock_q
    mock_q.limit.return_value = mock_q
    mock_q.all.return_value = cluster_list or []
    mock_q.first.return_value = (fv,) if fv is not None else None
    db.query.return_value = mock_q

    return db


class TestAssignCluster:
    def test_zero_gps_creates_new_cluster(self):
        db = _make_db_no_postgis()
        with patch.object(_svc, "_upsert_cluster") as mock_up:
            cid = assign_cluster(0.0, 0.0, "坑槽", None, db)
        args, kwargs = mock_up.call_args
        assert kwargs.get("is_new") is True or args[4] is True
        import uuid; uuid.UUID(cid)

    def test_fake_location_creates_new_cluster(self):
        db = _make_db_no_postgis()
        with patch.object(_svc, "_upsert_cluster") as mock_up:
            cid = assign_cluster(31.23, 121.47, "坑槽", None, db, location_is_real=False)
        args, kwargs = mock_up.call_args
        assert kwargs.get("is_new") is True or args[4] is True

    def test_no_candidates_creates_new_cluster(self):
        db = _make_db_no_postgis(cluster_list=[])
        with patch.object(_svc, "_upsert_cluster") as mock_up:
            assign_cluster(31.23, 121.47, "坑槽", None, db)
        args, kwargs = mock_up.call_args
        assert kwargs.get("is_new") is True or args[4] is True

    def test_nearby_candidate_merges(self):
        """1 m 以内的坑槽候选 → 应合并（无视觉特征，spatial_score=0.75，combined=0.675>0.62）。"""
        lat, lng = 31.23, 121.47
        delta = 1.0 / 111_111.0
        cl = _make_cluster_mock("existing-1", lat=lat + delta, lng=lng)
        db = _make_db_no_postgis(cluster_list=[cl], fv=None)

        with patch.object(_svc, "_upsert_cluster") as mock_up:
            cid = assign_cluster(lat, lng, "坑槽", None, db)

        assert cid == "existing-1"

    def test_distant_candidate_creates_new(self):
        """50 m 外的候选 → 建新簇。"""
        lat, lng = 31.23, 121.47
        delta = 50.0 / 111_111.0
        cl = _make_cluster_mock("far-1", lat=lat + delta, lng=lng)
        db = _make_db_no_postgis(cluster_list=[cl])

        with patch.object(_svc, "_upsert_cluster") as mock_up:
            cid = assign_cluster(lat, lng, "坑槽", None, db)

        assert cid != "far-1"
        args, kwargs = mock_up.call_args
        assert kwargs.get("is_new") is True or args[4] is True

    def test_visual_strong_match_relaxes_threshold(self):
        """视觉强匹配（≥0.92）+ 纵向裂缝 10 m → 应合并（relaxed_m=14m）。"""
        lat, lng = 31.23, 121.47
        delta = 10.0 / 111_111.0
        cl = _make_cluster_mock("visual-1", lat=lat + delta, lng=lng)
        db = _make_db_no_postgis(cluster_list=[cl], fv=[1.0] * 32)

        # 新记录和候选用相同向量 → cosine=1.0 > VISUAL_STRONG
        fv = [1.0] * 32
        with patch.object(_svc, "_upsert_cluster") as mock_up:
            cid = assign_cluster(lat, lng, "纵向裂缝", fv, db)

        assert cid == "visual-1"

    def test_visual_weak_below_threshold_rejects(self):
        """余弦相似度 < VISUAL_WEAK → 即使距离近也拒绝合并。"""
        lat, lng = 31.23, 121.47
        delta = 3.0 / 111_111.0
        cl = _make_cluster_mock("reject-1", lat=lat + delta, lng=lng)
        # 正交向量 → cosine=0.0 < VISUAL_WEAK
        db = _make_db_no_postgis(cluster_list=[cl], fv=[1.0, 0.0] + [0.0] * 30)

        fv_new = [0.0, 1.0] + [0.0] * 30
        with patch.object(_svc, "_upsert_cluster") as mock_up:
            cid = assign_cluster(lat, lng, "坑槽", fv_new, db)

        assert cid != "reject-1"

    def test_numpy_feature_vector_merges_without_truthiness_error(self):
        """推理侧若返回 numpy 向量，也不能触发 ambiguous truth value 异常。"""
        import numpy as np

        lat, lng = 31.23, 121.47
        delta = 2.0 / 111_111.0
        cl = _make_cluster_mock("numpy-1", lat=lat + delta, lng=lng)
        db = _make_db_no_postgis(cluster_list=[cl], fv=[1.0] * 32)

        with patch.object(_svc, "_upsert_cluster"):
            cid = assign_cluster(lat, lng, "坑槽", np.ones(32), db)

        assert cid == "numpy-1"

    def test_candidate_with_missing_coordinates_is_skipped(self):
        """历史脏数据候选缺少坐标时跳过，不阻断新记录建簇。"""
        cl = _make_cluster_mock("broken-1", lat=None, lng=121.47)
        db = _make_db_no_postgis(cluster_list=[cl])

        with patch.object(_svc, "_upsert_cluster") as mock_up:
            cid = assign_cluster(31.23, 121.47, "坑槽", None, db)

        assert cid != "broken-1"
        args, kwargs = mock_up.call_args
        assert kwargs.get("is_new") is True or args[4] is True

    def test_severity_passed_to_upsert(self):
        """conf + bbox 应传递给 _upsert_cluster 的 severity 参数。"""
        db = _make_db_no_postgis()
        bbox = [0, 0, 250, 200]  # → severity=5
        with patch.object(_svc, "_upsert_cluster") as mock_up:
            assign_cluster(31.23, 121.47, "坑槽", None, db,
                           confidence=1.0, bbox=bbox, location_is_real=False)
        args, kwargs = mock_up.call_args
        assert kwargs.get("severity") == 5 or args[5] == 5


# ════════════════════════════════════════════════════════════════════════════
# 类型差异化阈值
# ════════════════════════════════════════════════════════════════════════════

class TestLabelThresholds:
    def test_all_entries_have_positive_thresholds(self):
        for label, (strict, relaxed) in _LABEL_THRESHOLDS.items():
            assert strict > 0
            assert relaxed > strict

    def test_pothole_has_smallest_strict(self):
        pit_strict, _ = _LABEL_THRESHOLDS["坑槽"]
        for label in ("纵向裂缝", "横向裂缝", "龟裂"):
            assert pit_strict <= _LABEL_THRESHOLDS[label][0]

    def test_linear_cracks_strict_at_least_8m(self):
        for label in ("纵向裂缝", "横向裂缝"):
            assert _LABEL_THRESHOLDS[label][0] >= 8.0

    def test_candidate_radius_covers_widest_relaxed(self):
        max_r = max(r for _, r in _LABEL_THRESHOLDS.values())
        assert CANDIDATE_RADIUS_M > max_r


# ════════════════════════════════════════════════════════════════════════════
# 超参数完整性
# ════════════════════════════════════════════════════════════════════════════

class TestHyperparameters:
    def test_alpha_plus_beta_equals_one(self):
        assert ALPHA + BETA == pytest.approx(1.0, abs=1e-6)

    def test_merge_threshold_in_range(self):
        assert 0.4 < MERGE_THRESHOLD < 0.9

    def test_visual_thresholds_ordered(self):
        assert VISUAL_WEAK < VISUAL_STRONG < 1.0

    def test_relaxed_greater_than_strict(self):
        assert SPATIAL_RELAXED_M > SPATIAL_THRESHOLD_M

    def test_time_bonus_max_small_relative_to_threshold(self):
        # time_bonus 不超过 merge_threshold 的 15%，避免时间因素主导
        assert _TIME_BONUS_MAX < MERGE_THRESHOLD * 0.15
