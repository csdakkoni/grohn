export default function ContactPage() {
    return (
        <div className="section-spacing">
            <div className="container max-w-3xl">
                <div className="text-center mb-16">
                    <h1 className="text-4xl font-heading mb-4">Get in Touch</h1>
                    <p className="text-muted">Have questions about an order or want to discuss a custom project?</p>
                </div>

                <form className="space-y-8 bg-soft p-8 md:p-16 border border-light">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-[0.2em] mb-3 text-muted">Full Name</label>
                            <input type="text" className="w-full p-4 bg-white border border-light focus:border-accent outline-none transition-all font-light" placeholder="e.g. Julianne Moore" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-[0.2em] mb-3 text-muted">Email Address</label>
                            <input type="email" className="w-full p-4 bg-white border border-light focus:border-accent outline-none transition-all font-light" placeholder="hello@agoraloom.com" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-[0.2em] mb-3 text-muted">Your Inquiry</label>
                        <textarea rows={6} className="w-full p-4 bg-white border border-light focus:border-accent outline-none transition-all font-light" placeholder="How can we assist you today?"></textarea>
                    </div>
                    <button type="submit" className="btn-primary w-full py-5 text-sm font-bold tracking-widest uppercase">Send Inquiry</button>
                    <p className="text-[10px] text-center text-muted uppercase tracking-widest">Typical response time: Within 24 hours</p>
                </form>

                <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-8 text-center md:text-left">
                    <div>
                        <h3 className="font-bold mb-2">Email Us</h3>
                        <p className="text-muted">support@yourstore.com</p>
                    </div>
                    <div>
                        <h3 className="font-bold mb-2">Studio Hours</h3>
                        <p className="text-muted">Monday – Friday: 9am – 5pm EST</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
