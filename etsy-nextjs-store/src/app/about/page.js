export default function AboutPage() {
    return (
        <div className="section-spacing">
            <div className="container max-w-3xl">
                <div className="mb-20 text-center">
                    <span className="text-accent text-[10px] font-bold tracking-[0.3em] uppercase mb-6 block italic">Our Heritage</span>
                    <h1 className="text-5xl md:text-7xl font-heading mb-10 leading-tight">Woven with Purpose,<br /> <span className="italic font-light">Defined by Nature</span></h1>
                    <p className="text-xl md:text-2xl text-muted font-light leading-relaxed max-w-2xl mx-auto">
                        AgoraLoom was born from a simple desire: to bring the quiet, unhurried beauty of the natural world into the spaces we call home.
                    </p>
                </div>

                <div className="space-y-12 text-main leading-relaxed">
                    <p>
                        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
                    </p>
                    <div style={{ borderLeft: '4px solid var(--accent)', paddingLeft: '24px', fontStyle: 'italic', fontSize: '1.2rem', color: 'var(--fg-muted)' }}>
                        "We believe that every object in your home should tell a story of dedication, quality, and soul."
                    </div>
                    <p>
                        Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
                    </p>
                    <p>
                        Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.
                    </p>
                </div>

                <div className="mt-20 p-12 bg-soft rounded-2xl text-center border border-light">
                    <h2 className="text-2xl font-heading mb-4">Join Our Journey</h2>
                    <p className="text-muted mb-8">Follow our daily studio life and new arrivals on social media.</p>
                    <button className="btn-primary">Follow on Instagram</button>
                </div>
            </div>
        </div>
    );
}
