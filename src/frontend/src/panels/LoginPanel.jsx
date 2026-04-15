// src/panels/LoginPanel.jsx
import React, { useState } from 'react';
import styles from './LoginPanel.module.css';
import { loginUser, registerUser } from '../api/auth';

export default function LoginPanel({ onLoginSuccess }) {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
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
      onLoginSuccess();
    } catch (err) {
      setError(err.message || 'AUTH_REJECTED');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* 视觉张力区 */}
      <div className={styles.brandPanel}>
        <div className={styles.gridOverlay}></div>
        <div className={styles.brandContent}>
          <div className={styles.meta}>STABLE_VERSION_0.1.4 // SECURED</div>
          
          <h1 className={styles.hugeTitle}>
            <span>LIGHT</span>
            <span className={styles.indent}>SCAN</span>
          </h1>
          
          <div className={styles.divider}></div>
          <p className={styles.slogan}>轻巡智维 · 道路病害轻量化智能巡检系统</p>
        </div>
      </div>

      {/* 登录表单区 */}
      <div className={styles.formPanel}>
        <div className={styles.glowDivider}></div>

        <div className={styles.formWrapper}>
          <div className={styles.header}>
            <h2 className={styles.title}>
              {isLoginMode ? 'BOOT_SESSION' : 'REG_OPERATOR'}
              <span className={styles.dot}>_</span>
            </h2>
            <p className={styles.subtitle}>
              {isLoginMode ? '请输入操作员凭证以访问受限数据' : '请提交新操作员授权申请'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.inputGroup}>
              <label className={styles.label}>Operator_ID // 账户</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={styles.input}
                placeholder="ID_SEQUENCE"
                required
              />
            </div>
            
            <div className={styles.inputGroup}>
              <label className={styles.label}>Access_Key // 密钥</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={styles.input}
                placeholder="TOKEN_REQUIRED"
                required
              />
            </div>
            
            {error && <div className={styles.error}>[ ERROR: {error} ]</div>}

            <button type="submit" disabled={loading} className={styles.submitBtn}>
              {loading ? 'WAIT...' : isLoginMode ? 'INITIALIZE_TERMINAL' : 'REQUEST_ACCESS'}
            </button>
          </form>

          <div className={styles.toggleText}>
            {isLoginMode ? '// 尚未获得授权?' : '// 已有访问权限?'}
            <span onClick={() => setIsLoginMode(!isLoginMode)}>
              {isLoginMode ? '申请加入' : '返回登录'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}