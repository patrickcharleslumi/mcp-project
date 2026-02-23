/**
 * Echo endpoint - returns exactly what it receives
 * This helps debug what HubSpot's proxy is sending
 */

module.exports = async (req, res) => {
  try {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    // Handle preflight
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // Echo back everything
    const echo = {
      method: req.method,
      url: req.url,
      headers: req.headers,
      query: req.query,
      body: req.body,
      bodyType: typeof req.body,
      rawBody: req.body ? JSON.stringify(req.body) : null
    };

    console.log('=== ECHO ===');
    console.log(JSON.stringify(echo, null, 2));

    return res.status(200).json({
      success: true,
      echo: echo,
      message: 'Echo successful'
    });

  } catch (error) {
    console.error('Echo error:', error);
    return res.status(500).json({
      error: 'Echo failed',
      message: error.message
    });
  }
};
