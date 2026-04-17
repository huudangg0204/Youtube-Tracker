const { GoogleGenAI } = require('@google/genai');

// Thay YOUR_API_KEY bằng API Key thật của bạn
const ai = new GoogleGenAI({
  apiKey: "AIzaSyDooV5skoaIjslx9RbtgbfpMR4IXXn4Eog", // ←←← THAY Ở ĐÂY (replace with your actual API key)
});

async function listModels() {
  try {
    console.log("Đang lấy danh sách các model có sẵn...\n");

    const models = await ai.models.list({
      config: { pageSize: 50 }   // lấy tối đa 50 models mỗi lần
    });

    console.log("=== DANH SÁCH MODELS HIỆN CÓ ===\n");

    for await (const model of models) {
      console.log(`Model: ${model.name}`);
      if (model.displayName) console.log(`  Display Name: ${model.displayName}`);
      if (model.description) console.log(`  Description: ${model.description}`);
      console.log(`  Supported methods: ${model.supportedGenerationMethods ? model.supportedGenerationMethods.join(', ') : 'N/A'}`);
      console.log("----------------------------------------");
    }

  } catch (error) {
    console.error("Lỗi khi lấy danh sách models:");
    console.error(error.message);
    if (error.response) console.error(error.response.data);
  }
}

listModels();