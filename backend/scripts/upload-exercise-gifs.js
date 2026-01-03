const cloudinary = require('cloudinary').v2;
const https = require('https');
const http = require('http');

// Configure Cloudinary
cloudinary.config({
  cloud_name: 'dhehg2av2',
  api_key: '841496413155218',
  api_secret: 'ctOzSB-zHcHZ85mv_brXjP32LPQ'
});

// Exercise GIFs mapping - more exercises
const exerciseGifs = {
  // Piernas
  'hip_thrust': 'https://media.giphy.com/media/3o6MboVBrXqKFdh3Ow/giphy.gif',
  'prensa_piernas': 'https://media.giphy.com/media/1qfKN8Dt0CRdCRxz9q/giphy.gif',
  'extension_cuadriceps': 'https://media.giphy.com/media/1qfKN8Dt0CRdCRxz9q/giphy.gif',
  'curl_pierna': 'https://media.giphy.com/media/3oriO6aNSTVP1Yzdjq/giphy.gif',
  'elevacion_talones': 'https://media.giphy.com/media/1qfKN8Dt0CRdCRxz9q/giphy.gif',

  // Espalda
  'remo_barra': 'https://media.giphy.com/media/3oriO6aNSTVP1Yzdjq/giphy.gif',
  'remo_mancuerna': 'https://media.giphy.com/media/3oriO6aNSTVP1Yzdjq/giphy.gif',
  'jalon_pecho': 'https://media.giphy.com/media/xT9KVtKi5obPu77ohW/giphy.gif',

  // Hombros
  'elevacion_lateral': 'https://media.giphy.com/media/l0HlQGPJbJbXmDCxy/giphy.gif',
  'elevacion_frontal': 'https://media.giphy.com/media/l0HlQGPJbJbXmDCxy/giphy.gif',
  'face_pull': 'https://media.giphy.com/media/l0HlQGPJbJbXmDCxy/giphy.gif',

  // Triceps
  'extension_triceps': 'https://media.giphy.com/media/l3vRkwv2Grqg9xWZq/giphy.gif',
  'fondos_banco': 'https://media.giphy.com/media/7YCC7Vbdl1UfS/giphy.gif',

  // Pecho
  'aperturas': 'https://media.giphy.com/media/7YCC7Vbdl1UfS/giphy.gif',
  'press_inclinado': 'https://media.giphy.com/media/7YCC7Vbdl1UfS/giphy.gif'
};

async function uploadGif(name, url) {
  try {
    console.log(`Uploading ${name}...`);
    const result = await cloudinary.uploader.upload(url, {
      public_id: `exercises/${name}`,
      resource_type: 'image',
      overwrite: true
    });
    console.log(`✓ ${name}: ${result.secure_url}`);
    return result.secure_url;
  } catch (error) {
    console.error(`✗ ${name}: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('Uploading exercise GIFs to Cloudinary...\n');

  const results = {};

  for (const [name, url] of Object.entries(exerciseGifs)) {
    const cloudinaryUrl = await uploadGif(name, url);
    if (cloudinaryUrl) {
      results[name] = cloudinaryUrl;
    }
  }

  console.log('\n=== Results ===');
  console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error);
