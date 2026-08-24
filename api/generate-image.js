// api/generate-image.js
// 火山方舟 Doubao-Seedream 图像生成 - 修复版（简化参数）

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: '只允许POST请求' });

  const { imageBase64, prompt } = req.body;
  const ARK_API_KEY = process.env.ARK_API_KEY;
  const MODEL_ID = process.env.MODEL_ID || 'doubao-seedream-4-5-251128';

  if (!ARK_API_KEY) {
    return res.status(500).json({ error: '未配置ARK_API_KEY', detail: '请在Vercel环境变量设置ARK_API_KEY' });
  }

  try {
    const requestBody = {
      model: MODEL_ID,
      prompt: prompt || '像素风Q版卡通，黑色粗轮廓，高饱和度纯色块，纯白色背景',
      response_format: 'url'
    };

    // 图生图模式
    if (imageBase64) {
      if (imageBase64.startsWith('data:image')) {
        requestBody.image = imageBase64;
      } else {
        requestBody.image = `data:image/png;base64,${imageBase64}`;
      }
    }

    console.log('[AI] 请求模型:', MODEL_ID);
    console.log('[AI] 有图片:', !!imageBase64);
    console.log('[AI] 请求体:', JSON.stringify({...requestBody, image: requestBody.image ? '[base64]' : undefined}));

    const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ARK_API_KEY}`
      },
      body: JSON.stringify(requestBody)
    });

    const responseText = await response.text();
    console.log('[AI] 状态码:', response.status);
    console.log('[AI] 响应:', responseText.substring(0, 500));

    let data;
    try { data = JSON.parse(responseText); } catch(e) {
      return res.status(500).json({ error: '响应不是JSON', detail: responseText.substring(0, 300) });
    }

    if (!response.ok) {
      return res.status(500).json({
        error: 'API错误',
        detail: data.error?.message || JSON.stringify(data).substring(0, 300),
        status: response.status
      });
    }

    const imageUrl = data?.data?.[0]?.url || data?.data?.[0]?.b64_json 
      ? `data:image/png;base64,${data.data[0].b64_json}` : null;

    if (!imageUrl) {
      return res.status(500).json({ error: '无法提取图片', detail: JSON.stringify(data).substring(0, 300) });
    }

    console.log('[AI] 成功');
    return res.status(200).json({ imageUrl });

  } catch (error) {
    console.error('[AI] 异常:', error);
    return res.status(500).json({ error: '服务器错误', detail: error.message });
  }
}
