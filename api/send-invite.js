import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { email, role, inviterName } = req.body;

    if (!email) {
        return res.status(400).json({ message: 'Email address is required' });
    }

    try {
        const { data, error } = await resend.emails.send({
            from: 'Grohn ERP <noreply@resend.dev>', // In production, use a verified domain like noreply@grohn.com
            to: [email],
            subject: 'Grohn ERP Takımına Davet Edildiniz',
            html: `
        <div style="font-family: sans-serif; color: #333;">
          <h2>Merhaba!</h2>
          <p><strong>${inviterName || 'Yönetici'}</strong> sizi Grohn Kimya ERP sistemine <strong>${role}</strong> yetkisiyle davet etti.</p>
          <p>Aşağıdaki butona tıklayarak sisteme kayıt olabilir ve yetkilerinizi kullanmaya başlayabilirsiniz:</p>
          <a href="https://grohn-kimya.vercel.app/" style="display: inline-block; background-color: #0071e3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Sisteme Katıl</a>
          <p style="margin-top: 24px; font-size: 12px; color: #888;">Eğer bu daveti beklemiyorsanız, bu e-postayı görmezden gelebilirsiniz.</p>
        </div>
      `,
        });

        if (error) {
            return res.status(400).json(error);
        }

        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}
