import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { to, customerName, productName, batchNo, fileUrl } = req.body;

    if (!to || !fileUrl) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    try {
        const { data, error } = await resend.emails.send({
            from: 'Grohn Quality Control <noreply@resend.dev>',
            to: [to],
            subject: `Analiz Sertifikası (CoA): ${productName} - Batch #${batchNo}`,
            html: `
        <div style="font-family: sans-serif; color: #333;">
          <h2>Sayın ${customerName || 'Yetkili'},</h2>
          <p>Grohn Kimya'dan satın almış olduğunuz <strong>${productName}</strong> ürünümüze ait kalite kontrol ve analiz sonuçlarını (CoA) ekte bilgilerinize sunarız.</p>
          <p><strong>Batch No:</strong> ${batchNo}</p>
          <div style="margin: 20px 0;">
            <a href="${fileUrl}" style="display: inline-block; background-color: #2e7d32; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Sertifikayı İndir (PDF)</a>
          </div>
          <p>Her türlü sorunuz için bizimle iletişime geçebilirsiniz.</p>
          <p>Saygılarımızla,<br>Grohn Kimya Kalite Güvence Ekibi</p>
        </div>
      `,
            attachments: [
                {
                    filename: `CoA-${batchNo}.pdf`,
                    path: fileUrl,
                },
            ],
        });

        if (error) {
            return res.status(400).json(error);
        }

        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}
