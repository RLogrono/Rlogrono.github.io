// ===== CIERRE ANIMADO DEL WARNING BANNER =====
document.addEventListener('DOMContentLoaded', () => {
    const closeWarningBtn = document.querySelector('.close-warning');
    if (closeWarningBtn) {
        closeWarningBtn.addEventListener('click', function() {
            const banner = document.querySelector('.warning-banner');
            banner.style.animation = 'slideUp 0.5s ease-out forwards';
            setTimeout(() => {
                banner.style.display = 'none';
            }, 500);
        });
    }
});

// ===== INTERSECTION OBSERVER PARA ANIMACIONES DE SCROLL =====
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -100px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            // Animar elementos fade-in-left
            if (entry.target.classList.contains('fade-in-left')) {
                entry.target.classList.add('visible');
            }
            
            // Animar tarjetas de proyectos
            if (entry.target.classList.contains('project-card')) {
                entry.target.style.animation = `slideUpCards 0.6s ease-out forwards`;
            }

            // Animar skill tags
            if (entry.target.classList.contains('skill-tag')) {
                entry.target.style.animation = `slideUp 0.5s ease-out forwards`;
            }

            observer.unobserve(entry.target);
        }
    });
}, observerOptions);

// Observar todos los elementos con animación
document.addEventListener('DOMContentLoaded', () => {
    const fadeInElements = document.querySelectorAll('.fade-in-left');
    const projectCards = document.querySelectorAll('.project-card');
    const skillTags = document.querySelectorAll('.skill-tag');

    fadeInElements.forEach(el => observer.observe(el));
    projectCards.forEach(el => observer.observe(el));
    skillTags.forEach(el => observer.observe(el));
});

// ===== PARALLAX EFFECT =====
window.addEventListener('scroll', () => {
    const scrolled = window.pageYOffset;
    const hero = document.querySelector('.hero');
    
    if (hero) {
        hero.style.backgroundPosition = `0px ${scrolled * 0.5}px`;
    }
});

// ===== SMOOTH SCROLL PARA LINKS DE NAVEGACIÓN =====
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (href !== '#') {
            e.preventDefault();
            const target = document.querySelector(href);
            if (target) {
                const offsetTop = target.offsetTop - 80;
                window.scrollTo({
                    top: offsetTop,
                    behavior: 'smooth'
                });
            }
        }
    });
});

// ===== ESCONDER SCROLL INDICATOR AL SCROLLEAR =====
const scrollIndicator = document.querySelector('.scroll-indicator');
if (scrollIndicator) {
    window.addEventListener('scroll', () => {
        if (window.pageYOffset > 100) {
            scrollIndicator.style.opacity = '0';
            scrollIndicator.style.pointerEvents = 'none';
        } else {
            scrollIndicator.style.opacity = '1';
            scrollIndicator.style.pointerEvents = 'auto';
        }
    });
}

// ===== EFECTO MOUSE PARALLAX EN TARJETAS =====
document.querySelectorAll('.project-card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const rotateX = (y - centerY) / 10;
        const rotateY = (centerX - x) / 10;

        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    });

    card.addEventListener('mouseleave', () => {
        card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0)';
    });
});

// ===== CONTADORES ANIMADOS (BONUS) =====
function animateCounter(element, target, duration = 2000) {
    let current = 0;
    const increment = target / (duration / 16);
    
    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            current = target;
            clearInterval(timer);
        }
        element.textContent = Math.floor(current);
    }, 16);
}

// ===== EFECTO DE HOVER EN NAVEGACIÓN =====
const navLinks = document.querySelectorAll('.nav-links a');
navLinks.forEach(link => {
    link.addEventListener('mouseenter', function() {
        this.style.color = 'var(--primary-color)';
    });
    
    link.addEventListener('mouseleave', function() {
        this.style.color = 'var(--text-dark)';
    });
});

// ===== ANIMACIÓN AL ENTRAR A LA PÁGINA =====
window.addEventListener('load', () => {
    const profileImage = document.querySelector('.profile-image');
    const heroTitle = document.querySelector('.hero-title');
    const heroSubtitle = document.querySelector('.hero-subtitle');

    if (profileImage) {
        profileImage.style.animation = 'scaleIn 0.8s ease-out';
    }
    
    if (heroTitle) {
        heroTitle.style.animation = 'slideInUp 0.8s ease-out 0.2s both';
    }
    
    if (heroSubtitle) {
        heroSubtitle.style.animation = 'slideInUp 0.8s ease-out 0.4s both';
    }
});

// ===== DETECTAR SECCIÓN ACTIVA EN SCROLL =====
window.addEventListener('scroll', () => {
    let current = '';
    
    const sections = document.querySelectorAll('section[id]');
    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.clientHeight;
        
        if (pageYOffset >= sectionTop - 200) {
            current = section.getAttribute('id');
        }
    });

    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href').slice(1) === current) {
            link.style.color = 'var(--primary-color)';
        }
    });
});

// ===== EFECTO TYPEWRITER PARA TEXTOS (BONUS) =====
function typeWriter(element, text, speed = 50) {
    element.textContent = '';
    let index = 0;
    
    function type() {
        if (index < text.length) {
            element.textContent += text.charAt(index);
            index++;
            setTimeout(type, speed);
        }
    }
    
    type();
}

// ===== ANIMACIÓN DE APARICIÓN AL CARGAR =====
window.addEventListener('DOMContentLoaded', () => {
    const quoteCard = document.querySelector('.quote-card');
    if (quoteCard) {
        quoteCard.style.animation = 'fadeInScale 0.8s ease-out 0.3s both';
    }
});
