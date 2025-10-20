const nodemailer = require('nodemailer');

console.log('Nodemailer version:', require('nodemailer/package.json').version);
console.log('createTransporter type:', typeof nodemailer.createTransporter);

try {
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: 'test@gmail.com',
      pass: 'test'
    }
  });
  
  console.log('✅ Transporter created successfully!');
  console.log('Transporter:', transporter);
} catch (error) {
  console.error('❌ Error creating transporter:', error);
}

