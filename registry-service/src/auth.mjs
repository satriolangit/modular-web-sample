export function bearerAuth(config) {
  return (req, res, next) => {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (token !== config.adminToken) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    next();
  };
}
