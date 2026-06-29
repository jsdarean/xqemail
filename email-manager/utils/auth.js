/**
 * 基于 Session 的认证中间件
 */
function requireAuth(req, res, next) {
    if (req.session && req.session.isAuthenticated) {
        return next();
    }

    // 判断是 API 请求还是页面请求
    const isApiRequest = req.path.startsWith('/api/') || req.xhr || req.headers.accept === 'application/json';

    if (isApiRequest) {
        return res.status(401).json({ success: false, error: '未登录或登录已过期' });
    }

    // 页面请求重定向到登录页
    res.redirect('/login.html');
}

module.exports = requireAuth;
