document.addEventListener('DOMContentLoaded', function() {
    initNavigation();
    initSidebar();
    initFooter();
});

function initNavigation() {
    const header = document.getElementById('header-placeholder');
    if (!header) return;

    const currentPage = window.location.pathname.split("/").pop() || 'index.html';

    header.innerHTML = `
        <header>
            <div class="container">
                <nav>
                    <div class="header-name">
                        <a href="index.html">Dr. Md. Saidur Rahman</a>
                    </div>
                    <button id="menu-toggle" class="menu-toggle">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>
                    <ul id="nav-menu">
                        <li><a href="index.html" class="${currentPage === 'index.html' ? 'active' : ''}">Home</a></li>
                        <li><a href="publications.html" class="${currentPage === 'publications.html' ? 'active' : ''}">Publications</a></li>
                        <li><a href="projects.html" class="${currentPage === 'projects.html' ? 'active' : ''}">Projects</a></li>
                        <li><a href="fieldworks.html" class="${currentPage === 'fieldworks.html' ? 'active' : ''}">Field Works</a></li>
                        <li><a href="teaching.html" class="${currentPage === 'teaching.html' ? 'active' : ''}">Teaching</a></li>
                        <li><a href="contact.html" class="${currentPage === 'contact.html' ? 'active' : ''}">Contact</a></li>
                        <li><a href="CV/CV_Saidur_Rahman_UK1.pdf" target="_blank" class="cv-link">CV</a></li>
                    </ul>
                </nav>
            </div>
        </header>
    `;

    const menuToggle = document.getElementById('menu-toggle');
    const navMenu = document.getElementById('nav-menu');

    if (menuToggle && navMenu) {
        menuToggle.addEventListener('click', function() {
            navMenu.classList.toggle('show');
        });
    }
}

function initSidebar() {
    const sidebar = document.getElementById('sidebar-placeholder');
    if (!sidebar) return;

    sidebar.innerHTML = `
        <div class="sidebar">
            <img src="photo/profile.jpg" alt="Dr. Md. Saidur Rahman" class="profile-img">
            <h1>Dr. Md. Saidur Rahman</h1>
            <p>Professor of Forestry and Wood Technology<br>Khulna University, Bangladesh</p>
            
            <ul class="social-links">
                <li><a href="mailto:msrahman@fwt.ku.ac.bd"><i class="fas fa-envelope"></i> msrahman@fwt.ku.ac.bd</a></li>
                <li><a href="https://ku.ac.bd/discipline/fwt/faculty/ranju_fwt" target="_blank"><i class="fas fa-university"></i> Khulna University Profile</a></li>
                <li><a href="https://www.durham.ac.uk/staff/md-s-rahman/#overview" target="_blank"><i class="fas fa-graduation-cap"></i> Durham University Profile</a></li>
                <li><a href="http://bd.linkedin.com/in/mdsrahman" target="_blank"><i class="fab fa-linkedin"></i> LinkedIn</a></li>
                <li><a href="https://orcid.org/0000-0001-6849-4105" target="_blank"><i class="fab fa-orcid"></i> ORCID</a></li>
                <li><a href="https://www.scopus.com/authid/detail.uri?authorId=57217464411" target="_blank"><i class="fas fa-search"></i> Scopus</a></li>
            </ul>
        </div>
    `;
}

function initFooter() {
    const footer = document.getElementById('footer-placeholder');
    if (!footer) return;

    footer.innerHTML = `
        <footer>
            <div class="container">
                <p>&copy; ${new Date().getFullYear()} Dr. Md. Saidur Rahman. All rights reserved.</p>
                <p>Professor, Khulna University, Bangladesh</p>
            </div>
        </footer>
    `;
}
