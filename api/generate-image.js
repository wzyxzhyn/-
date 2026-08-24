// api/generate-image.js
// 终极版：后端代理下载图片转base64，彻底解决跨域问题

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
    return res.status(500).json({ error: '未配置ARK_API_KEY', detail: '请在Vercel环境变量设置ARK_API_KEY（sk-开头）' });
  }

  try {
    // 第一步：调用火山方舟生成图片
    const requestBody = {
      model: MODEL_ID,
      prompt: prompt || '像素风Q版卡通，黑色粗轮廓，高饱和度纯色块，纯白色背景',
      response_format: 'url'
    };

    if (imageBase64) {
      requestBody.image = imageBase64.startsWith('data:image') 
        ? imageBase64 
        : `data:image/png;base64,${imageBase64}`;
    }

    console.log('[AI-1] 调用火山方舟，模型:', MODEL_ID);

    const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ARK_API_KEY}`
      },
      body: JSON.stringify(requestBody)
    });

    const responseText = await response.text();
    console.log('[AI-2] 火山方舟状态:', response.status);
    console.log('[AI-3] 响应前300字:', responseText.substring(0, 300));

    let data;
    try { data = JSON.parse(responseText); } catch(e) {
      return res.status(500).json({ error: '火山方舟返回非JSON', detail: responseText.substring(0, 300) });
    }

    if (!response.ok) {
      return res.status(500).json({ 
        error: '火山方舟API错误', 
        detail: data.error?.message || JSON.stringify(data).substring(0, 300),
        status: response.status
      });
    }

    // 第二步：获取图片URL
    const imageUrl = data?.data?.[0]?.url;
    if (!imageUrl) {
      return res.status(500).json({ error: '火山方舟未返回图片URL', detail: JSON.stringify(data).substring(0, 300) });
    }
    console.log('[AI-4] 图片URL:', imageUrl.substring(0, 80));

    // 第三步：后端下载图片，转base64（解决跨域）
    console.log('[AI-5] 开始下载图片...');
    const imgResponse = await fetch(imageUrl);
    if (!imgResponse.ok) {
      return res.status(500).json({ error: '图片下载失败', detail: `HTTP ${imgResponse.status}` });
    }

    const arrayBuffer = await imgResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');
    const contentType = imgResponse.headers.get('content-type') || 'image/png';

    console.log('[AI-6] 图片下载成功，大小:', buffer.length, '字节，类型:', contentType);

    // 第四步：返回base64图片给前端
    return res.status(200).json({ 
      imageUrl: `data:${contentType};base64,${base64}`,
      success: true
    });

  } catch (error) {
    console.error('[AI-ERROR]', error);
    return res.status(500).json({ error: '服务器异常', detail: error.message, stack: error.stack?.substring(0, 200) });
  }
}
