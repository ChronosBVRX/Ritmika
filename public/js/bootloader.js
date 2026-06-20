/**
 * Ritmika - Premium Bootloader
 * Canvas + GSAP Implementation
 */

(function() {
    let canvas, ctx;
    let particles = [];
    let animationFrameId;
    let chevronOffset = 0;
    
    // Ritmika Neo-Brutalist Colors
    const colors = ['#ffe600', '#00e5ff', '#f0047f', '#ec4899', '#ffffff'];
    
    class Particle {
        constructor() {
            this.reset();
            // Distribute randomly across the screen initially so it's not empty
            this.y = Math.random() * window.innerHeight;
        }

        reset() {
            this.x = Math.random() * window.innerWidth;
            this.y = -50 - Math.random() * 200; // Start above screen
            this.size = Math.random() * 15 + 10; // 10 to 25 px
            this.speedY = Math.random() * 3 + 2; // Falling speed
            this.speedX = (Math.random() - 0.5) * 2; // Drift
            this.rotation = Math.random() * Math.PI * 2;
            this.rotationSpeed = (Math.random() - 0.5) * 0.1;
            
            // For 3D simulation
            this.flipAngle = Math.random() * Math.PI * 2;
            this.flipSpeed = Math.random() * 0.1 + 0.05;

            this.color = colors[Math.floor(Math.random() * colors.length)];
            
            // Random shape: 0 = square, 1 = circle, 2 = triangle
            this.shape = Math.floor(Math.random() * 3);
            this.opacity = Math.random() * 0.5 + 0.5; // 0.5 to 1.0
        }

        update() {
            this.y += this.speedY;
            this.x += this.speedX;
            this.rotation += this.rotationSpeed;
            this.flipAngle += this.flipSpeed;

            // Recycle if out of bounds
            if (this.y > window.innerHeight + 50) {
                this.reset();
            }
        }

        draw(ctx) {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.rotation);
            
            // Simulate 3D flip by scaling Y axis
            const scaleY = Math.cos(this.flipAngle);
            ctx.scale(1, scaleY);
            
            ctx.globalAlpha = this.opacity;
            ctx.fillStyle = this.color;
            ctx.beginPath();
            
            if (this.shape === 0) { // Square
                ctx.rect(-this.size/2, -this.size/2, this.size, this.size);
            } else if (this.shape === 1) { // Circle
                ctx.arc(0, 0, this.size/2, 0, Math.PI * 2);
            } else { // Triangle
                ctx.moveTo(0, -this.size/2);
                ctx.lineTo(this.size/2, this.size/2);
                ctx.lineTo(-this.size/2, this.size/2);
                ctx.closePath();
            }
            
            ctx.fill();
            ctx.restore();
        }
    }

    function initCanvas() {
        canvas = document.getElementById('boot-canvas-bg');
        if (!canvas) return;
        
        ctx = canvas.getContext('2d', { alpha: false }); // Optimize performance
        
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        // Initialize object pool
        particles = [];
        for (let i = 0; i < 150; i++) {
            particles.push(new Particle());
        }

        // Start GSAP Heartbeat on the main container
        // 128 BPM = ~468.75ms per beat.
        const bootContent = document.querySelector('.boot-content');
        if (bootContent && typeof gsap !== 'undefined') {
            gsap.to(bootContent, {
                scale: 1.05,
                duration: 60 / 128, // Sync with 128 BPM
                ease: 'back.out(1.7)',
                yoyo: true,
                repeat: -1
            });
        }

        animate();
    }

    function resizeCanvas() {
        if (!canvas) return;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    function drawChevronBackground() {
        const width = canvas.width;
        const height = canvas.height;
        
        // Base dark background
        ctx.fillStyle = '#0f172a'; // Ritmika dark blue
        ctx.fillRect(0, 0, width, height);
        
        ctx.save();
        ctx.beginPath();
        
        const stripeWidth = 60;
        const spacing = 120; // 60 width + 60 gap
        
        chevronOffset = (chevronOffset + 1.5) % spacing;
        
        // Draw diagonal stripes
        ctx.fillStyle = '#1e293b'; // Slightly lighter blue for subtle pattern
        
        // Need to draw from way off-screen to cover the diagonal
        for (let x = -height + chevronOffset; x < width; x += spacing) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x + stripeWidth, 0);
            ctx.lineTo(x + height + stripeWidth, height);
            ctx.lineTo(x + height, height);
            ctx.closePath();
        }
        ctx.fill();
        ctx.restore();
        
        // Draw Vignette Gradient
        const cx = width / 2;
        const cy = height / 2;
        const maxRadius = Math.max(cx, cy) * 1.5;
        
        const gradient = ctx.createRadialGradient(cx, cy, maxRadius * 0.3, cx, cy, maxRadius);
        gradient.addColorStop(0, 'rgba(15, 23, 42, 0)');
        gradient.addColorStop(1, 'rgba(15, 23, 42, 0.9)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
    }

    function animate() {
        if (!ctx) return;
        
        drawChevronBackground();

        for (let i = 0; i < particles.length; i++) {
            particles[i].update();
            particles[i].draw(ctx);
        }

        animationFrameId = requestAnimationFrame(animate);
    }

    // Expose cleanup function globally
    window.destroyBootloader = function() {
        console.log('[Bootloader] Cleanup initialized...');
        
        // Stop canvas animation
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        
        // Stop GSAP animations
        if (typeof gsap !== 'undefined') {
            gsap.killTweensOf('.boot-content');
        }
        
        // Remove event listeners
        window.removeEventListener('resize', resizeCanvas);
        
        // Clear canvas context to release memory
        if (canvas) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            canvas.style.display = 'none';
        }
    };

    // Auto-init if DOM is already loaded, otherwise wait
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCanvas);
    } else {
        initCanvas();
    }

})();
