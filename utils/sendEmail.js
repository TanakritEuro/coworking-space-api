const nodemailer = require('nodemailer');

//Send an email through SMTP. Without SMTP settings (development only) the email is printed to the console instead
const sendEmail = async ({ email, subject, message }) => {
    if (!process.env.SMTP_HOST) {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('SMTP is not configured');
        }
        console.log(`\n--- Email (SMTP not configured, printed instead) ---\nTo: ${email}\nSubject: ${subject}\n\n${message}\n----------------------------------------------------\n`);
        return;
    }

    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });

    await transporter.sendMail({
        from: process.env.FROM_EMAIL || process.env.SMTP_USER,
        to: email,
        subject,
        text: message
    });
};

module.exports = sendEmail;
