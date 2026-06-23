require('dotenv').config();
const OpenAI = require('openai');

const apiKey = process.env.OPENAI_API_KEY;

console.log("🔍 Testing OpenAI API Key...");
console.log("Key starts with:", apiKey?.substring(0, 10));

if (!apiKey || !apiKey.startsWith('sk-proj-')) {
  console.error("❌ Invalid API Key format!");
  console.log("💡 The key should start with 'sk-proj-'");
  process.exit(1);
}

console.log("✅ Key format looks valid");
console.log("Testing API call...");

const client = new OpenAI({ apiKey });

async function test() {
  try {
    const completion = await client.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Say 'Hello World' in 5 words" }
      ],
      max_tokens: 50,
      temperature: 0.7,
    });

    console.log("✅ SUCCESS! Response:", completion.choices[0].message.content);
    console.log("✅ OpenAI is working perfectly!");
  } catch (error) {
    console.error("❌ Error:", error.message);
    if (error.message.includes('401') || error.message.includes('auth')) {
      console.log("💡 Your API key is invalid. Please get a new one from:");
      console.log("   https://platform.openai.com/api-keys");
    }
    if (error.message.includes('429')) {
      console.log("💡 You've hit the rate limit. Please wait and try again.");
    }
  }
}

test();