document.addEventListener('DOMContentLoaded', function() {
    initNavigation();
    initSidebar();
    initFooter();
});

function initNavigation() {
    const header = document.getElementById('header-placeholder');
    if (!header) return;

    const currentPage = window.location.pathname.split("/").pop() || 'index.html';

    const getNavClass = (page) => {
        const isActive = currentPage === page;
        return `font-heading font-medium transition-colors duration-200 px-3 py-1.5 rounded-md ${
            isActive 
                ? 'text-brand-green bg-emerald-50 font-semibold' 
                : 'text-gray-700 hover:text-brand-green hover:bg-emerald-50/50'
        }`;
    };

    header.innerHTML = `
        <header class="bg-white shadow-sm fixed top-0 left-0 right-0 w-full z-50 border-b border-emerald-100">
            <div class="max-w-6xl mx-auto px-4 sm:px-6">
                <nav class="flex justify-between items-center h-16 relative">
                    <div class="flex items-center">
                        <a href="index.html" class="font-heading font-bold text-lg sm:text-xl text-brand-green hover:text-emerald-800 transition-colors">
                            Dr. Md. Saidur Rahman
                        </a>
                    </div>
                    
                    <button id="menu-toggle" class="md:hidden text-brand-green p-2 focus:outline-none hover:bg-emerald-50 rounded-md">
                        <i class="fas fa-bars text-xl"></i>
                    </button>
                    
                    <ul id="nav-menu" class="hidden md:flex items-center space-x-2 absolute md:relative top-16 md:top-0 left-0 right-0 bg-white md:bg-transparent shadow-md md:shadow-none p-4 md:p-0 border-b md:border-none border-emerald-100 flex-col md:flex-row space-y-2 md:space-y-0 w-full md:w-auto z-50">
                        <li><a href="index.html" class="${getNavClass('index.html')}">Home</a></li>
                        <li><a href="publications.html" class="${getNavClass('publications.html')}">Publications</a></li>
                        <li><a href="projects.html" class="${getNavClass('projects.html')}">Projects</a></li>
                        <li><a href="fieldworks.html" class="${getNavClass('fieldworks.html')}">Field Works</a></li>
                        <li><a href="teaching.html" class="${getNavClass('teaching.html')}">Teaching</a></li>
                        <li><a href="contact.html" class="${getNavClass('contact.html')}">Contact</a></li>
                        <li><a href="CV/CV_Saidur_Rahman_UK1.pdf" target="_blank" class="font-heading font-semibold text-white bg-brand-green hover:bg-emerald-800 transition-colors px-4 py-1.5 rounded-md inline-block shadow-sm">CV</a></li>
                    </ul>
                </nav>
            </div>
        </header>
    `;

    const menuToggle = document.getElementById('menu-toggle');
    const navMenu = document.getElementById('nav-menu');

    if (menuToggle && navMenu) {
        menuToggle.addEventListener('click', function() {
            navMenu.classList.toggle('hidden');
            navMenu.classList.toggle('flex');
        });
    }
}

function initSidebar() {
    const sidebar = document.getElementById('sidebar-placeholder');
    if (!sidebar) return;

    sidebar.innerHTML = `
        <div class="bg-white rounded-xl shadow-md p-6 border border-emerald-100 text-center sticky top-24">
            <img src="photo/profile.jpg" alt="Dr. Md. Saidur Rahman" class="w-44 h-44 rounded-full border-4 border-white shadow-md mx-auto mb-5 object-cover">
            <h1 class="font-heading font-bold text-xl text-brand-green mb-2">Dr. Md. Saidur Rahman</h1>
            <p class="text-sm text-gray-600 mb-6 leading-relaxed">Professor of Forestry and Wood Technology<br>Khulna University, Bangladesh</p>
            
            <ul class="space-y-3 text-left border-t border-emerald-50 pt-5">
                <li><a href="mailto:msrahman@fwt.ku.ac.bd" target="_blank" class="flex items-center text-sm text-gray-700 hover:text-brand-green transition-colors"><i class="fas fa-envelope w-6 text-brand-green"></i> msrahman@fwt.ku.ac.bd</a></li>
                <li><a href="https://ku.ac.bd/discipline/fwt/faculty/ranju_fwt" target="_blank" class="flex items-center text-sm text-gray-700 hover:text-brand-green transition-colors"><i class="fas fa-university w-6 text-brand-green"></i> Khulna University Profile</a></li>
                <li><a href="https://www.durham.ac.uk/staff/md-s-rahman/#overview" target="_blank" class="flex items-center text-sm text-gray-700 hover:text-brand-green transition-colors"><i class="fas fa-graduation-cap w-6 text-brand-green"></i> Durham University Profile</a></li>
                <li><a href="http://bd.linkedin.com/in/mdsrahman" target="_blank" class="flex items-center text-sm text-gray-700 hover:text-brand-green transition-colors"><i class="fab fa-linkedin w-6 text-brand-green"></i> LinkedIn</a></li>
                <li><a href="https://orcid.org/0000-0001-6849-4105" target="_blank" class="flex items-center text-sm text-gray-700 hover:text-brand-green transition-colors"><i class="fab fa-orcid w-6 text-brand-green"></i> ORCID</a></li>
                <li><a href="https://www.scopus.com/authid/detail.uri?authorId=57217464411" target="_blank" class="flex items-center text-sm text-gray-700 hover:text-brand-green transition-colors"><i class="fas fa-search w-6 text-brand-green"></i> Scopus</a></li>
            </ul>
        </div>
    `;
}

function initFooter() {
    const footer = document.getElementById('footer-placeholder');
    if (!footer) return;

    footer.innerHTML = `
        <footer class="bg-brand-green text-white text-center py-8 mt-16 border-t border-emerald-800">
            <div class="max-w-6xl mx-auto px-4 space-y-1">
                <p class="font-medium">&copy; ${new Date().getFullYear()} Dr. Md. Saidur Rahman. All rights reserved.</p>
                <p class="text-sm text-emerald-100 opacity-90">Professor, Khulna University, Bangladesh</p>
            </div>
        </footer>
    `;
}
