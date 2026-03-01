export default function handler(req, res) {
    return res.status(200).json({
        ok: true,
        node: process.version,
        env_keys: Object.keys(process.env).filter(k => k.startsWith('KV_') || k === 'JWT_SECRET').map(k => k + '=' + (process.env[k] ? 'SET' : 'MISSING'))
    });
}
