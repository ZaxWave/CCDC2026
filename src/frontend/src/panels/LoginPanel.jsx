// src/panels/LoginPanel.jsx
import React, { useState } from 'react';
import styles from './LoginPanel.module.css';
import { loginUser, registerUser } from '../api/auth';

export default function LoginPanel({ onLoginSuccess }) {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (!isLoginMode) await registerUser(username, password);
      const data = await loginUser(username, password);
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('username', username);
      if (rememberMe) localStorage.setItem('login_time', Date.now());
      else localStorage.removeItem('login_time');
      onLoginSuccess();
    } catch (err) {
      setError(err.message || 'AUTH_REJECTED');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <div className={styles.brandLockup}>
          <img className={styles.brandLogo} src="/lightscan-lockup.svg" alt="LightScan" />
        </div>
        <div className={styles.headerMeta}>道路病害智能巡检系统</div>
      </div>

      <main className={styles.stage}>
        <section className={styles.card} aria-label={isLoginMode ? '登录' : '注册'}>
          <img className={styles.logoMark} src="/lightscan-mark.svg" alt="LightScan" />

          <div className={styles.header}>
            <h2 className={styles.title}>{isLoginMode ? '欢迎回来' : '创建账号'}</h2>
            <p className={styles.subtitle}>
              {isLoginMode ? '请使用下方表单登录。' : '填写账号密码后将自动登录。'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.inputGroup}>
              <label className={styles.label}>账号</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={styles.input}
                placeholder="operator@example.com"
                required
              />
            </div>

            <div className={styles.inputGroup}>
              <div className={styles.labelRow}>
                <label className={styles.label}>密码</label>
                {isLoginMode && (
                  <button
                    type="button"
                    className={styles.textButton}
                    onClick={() => setError('请联系管理员重置密码')}
                  >
                    忘记密码？
                  </button>
                )}
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={styles.input}
                placeholder="Password"
                required
              />
            </div>

            {isLoginMode && (
              <label className={styles.rememberRow}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>保持登录状态</span>
              </label>
            )}

            {error && <div className={styles.error}>{error}</div>}

            <button type="submit" disabled={loading} className={styles.submitBtn}>
              {loading ? '请稍候' : isLoginMode ? '登录' : '注册并登录'}
            </button>
          </form>

          <div className={styles.divider}>
            <span></span>
            <em>或</em>
            <span></span>
          </div>

          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={() => setError('演示入口暂未开放，请使用账号密码登录')}
          >
            <span className={styles.secondaryIcon}>LS</span>
            使用演示身份进入
          </button>

          <div className={styles.toggleText}>
            {isLoginMode ? '还没有账号？' : '已有账号？'}
            <span onClick={() => setIsLoginMode(!isLoginMode)}>
              {isLoginMode ? '申请加入' : '返回登录'}
            </span>
          </div>
        </section>
      </main>
    </div>
  );
}
