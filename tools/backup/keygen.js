'use strict';
// 1.10.349: the key pair, once -- the private key into DB백업\keys\ (never anywhere else), the public key beside it and into
// tools/backup/backup-public.pem (public: it is committed, the server seals with it). Refuses to overwrite a private key.
//   node tools/backup/keygen.js
const crypto = require('crypto');
const fs = require('fs');
const C = require('./common');

if (fs.existsSync(C.PRIVATE_KEY)) { console.error(`개인 키가 이미 있어요: ${C.PRIVATE_KEY}\n지우면 그 키로 잠근 백업은 다시 못 열어요. 새로 만들려면 직접 옮겨 두고 다시 실행하세요.`); process.exit(1); }
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 3072, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
fs.mkdirSync(C.KEYS_DIR, { recursive: true });
fs.writeFileSync(C.PRIVATE_KEY, privateKey, { mode: 0o600 }); fs.writeFileSync(C.PUBLIC_KEY, publicKey); fs.writeFileSync(C.REPO_PUBLIC_KEY, publicKey);
console.log(`개인 키: ${C.PRIVATE_KEY} (이 PC 밖으로 보내지 마세요)`);
console.log(`공개 키: ${C.PUBLIC_KEY}, ${C.REPO_PUBLIC_KEY} (저장소에 올려도 돼요)`);
