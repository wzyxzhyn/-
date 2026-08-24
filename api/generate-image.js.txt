// api/generate-image.js
// 火山方舟 Doubao-Seedream 图像生成 API 代理（图生图模式）- 增强错误日志版

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: '只允许POST请求' });
  }

  const { imageBase64, prompt } = req.body;

  // 从环境变量读取火山方舟 API Key
  const ARK_API_KEY = process.env.ARK_API_KEY;
  const MODEL_ID = process.env.MODEL_ID || 'doubao-seedream-4-5-251128';

  console.log('[AI] 开始调用，模型:', MODEL_ID);
  console.log('[AI] API Key 是否存在:', !!ARK_API_KEY, '长度:', ARK_API_KEY?.length || 0);
  console.log('[AI] 提示词长度:', prompt?.length || 0);
  console.log('[AI] 图片数据长度:', imageBase64?.length || 0);

  if (!ARK_API_KEY) {
    console.error('[AI] 错误：未配置 ARK_API_KEY 环境变量');
    return res.status(500).json({ 
      error: '未配置火山方舟API Key',
      detail: '请在Vercel环境变量中设置 ARK_API_KEY（sk-开头），并重新部署'
    });
  }

  try {
    // 构建请求体
    const requestBody = {
      model: MODEL_ID,
      prompt: prompt || '像素风Q版卡通，黑色粗轮廓，高饱和度纯色块，纯白色背景',
      size: '1K',
      response_format: 'url',
      watermark: false,
      sequential_image_generation: 'disabled'
    };

    // 处理图片 base64 格式
    if (imageBase64) {
      let imgData = imageBase64;
      if (imgData.startsWith('data:image')) {
        // 已经是 data URL 格式，确保格式部分是小写
        // 格式: data:image/png;base64,xxx 或 data:image/jpeg;base64,xxx
        requestBody.image = imgData;
      } else {
        requestBody.image = `data:image/png;base64,${imgData}`;
      }
      console.log('[AI] 图片格式:', requestBody.image.substring(0, 50) + '...');
    }

    console.log('[AI] 请求体:', JSON.stringify({
      ...requestBody,
      image: requestBody.image ? `[base64长度:${requestBody.image.length}]` : undefined
    }));

    // 调用火山方舟 API，增加超时处理
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000); // 60秒超时

    const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ARK_API_KEY}`
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    clearTimeout(timeout);

    const responseText = await response.text();
    console.log('[AI] 响应状态:', response.status);
    console.log('[AI] 响应内容:', responseText.substring(0, 1000));

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('[AI] 响应不是JSON格式:', responseText);
      return res.status(500).json({ 
        error: 'API返回格式错误',
        detail: responseText.substring(0, 500)
      });
    }

    if (!response.ok) {
      console.error('[AI] API错误:', data);
      return res.status(500).json({ 
        error: 'AI生成失败（API错误）',
        detail: data.error?.message || data.error?.code || JSON.stringify(data).substring(0, 500),
        status: response.status
      });
    }

    // 解析返回的图片URL - 支持多种格式
    let imageUrl = null;
    
    // 标准格式: data[0].url
    if (data?.data?.[0]?.url) {
      imageUrl = data.data[0].url;
    }
    // 备选格式: data[0].b64_json
    else if (data?.data?.[0]?.b64_json) {
      imageUrl = `data:image/png;base64,${data.data[0].b64_json}`;
    }
    // 备选格式: data.url
    else if (data?.url) {
      imageUrl = data.url;
    }
    // 备选格式: data.images[0]
    else if (data?.images?.[0]) {
      imageUrl = data.images[0];
    }

    if (!imageUrl) {
      console.error('[AI] 无法从响应中提取图片URL:', data);
      return res.status(500).json({ 
        error: 'AI返回为空（无法提取图片）',
        detail: JSON.stringify(data).substring(0, 500)
      });
    }

    console.log('[AI] 成功，图片URL:', imageUrl.substring(0, 100) + '...');

    return res.status(200).json({ imageUrl });

  } catch (error) {
    console.error('[AI] 服务器异常:', error);
    if (error.name === 'AbortError') {
      return res.status(504).json({ error: 'AI生成超时（60秒）', detail: '请重试或更换网络' });
    }
    return res.status(500).json({ 
      error: '服务器错误', 
      detail: error.message,
      stack: error.stack?.substring(0, 300)
    });
  }
}
