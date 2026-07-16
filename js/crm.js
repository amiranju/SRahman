/**
 * Portfolio Content Management System (CMS) Logic
 * Uses Web File System Access API to read & write local HTML/JS portfolio files directly on disk.
 */

// Application State
const CMSState = {
    dirHandle: null,
    files: {}, // filename -> file content string or file handle
    modified: new Set(),
    data: {
        components: {
            name: '',
            role: '',
            institution: '',
            avatar: '',
            socials: []
        },
        index: {
            about: [],
            keyAreas: [],
            education: [],
            conferences: [],
            awards: [],
            affiliations: []
        },
        publications: {
            items: [],
            note: ''
        },
        projects: {
            current: [],
            past: []
        },
        fieldworks: {
            heading: '',
            description: ''
        },
        teaching: {
            experiences: [],
            trainings: []
        },
        contact: {
            intro: '',
            email: ''
        }
    }
};

// DOM Elements & Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initEventListeners();
    attemptAutoDetectOrInit();
});

// Sidebar Navigation Tabs
function initNavigation() {
    const navItems = document.querySelectorAll('.cms-nav .nav-item');
    const tabPanes = document.querySelectorAll('.tab-pane');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const tabId = item.getAttribute('data-tab');
            if (!tabId) return;

            navItems.forEach(n => n.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));

            item.classList.add('active');
            const activePane = document.getElementById(`tab-${tabId}`);
            if (activePane) {
                activePane.classList.add('active');
                document.getElementById('page-title-text').innerText = item.innerText.trim();
            }
        });
    });
}

function initEventListeners() {
    // Workspace Directory Selector
    document.getElementById('btn-select-dir').addEventListener('click', selectWorkspaceDirectory);
    document.getElementById('btn-select-dir-hero').addEventListener('click', selectWorkspaceDirectory);

    // Save Buttons
    document.getElementById('btn-save-all').addEventListener('click', saveAllFiles);

    // Preview Modal
    document.getElementById('btn-preview').addEventListener('click', openPreviewModal);
    document.getElementById('btn-close-preview').addEventListener('click', closePreviewModal);

    // Modal Background Clicks
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('active');
        });
    });
}

// Check if File System Access API is supported
function isFileSystemAccessSupported() {
    return 'showDirectoryPicker' in window;
}

// 1. Select Workspace Directory
async function selectWorkspaceDirectory() {
    if (!isFileSystemAccessSupported()) {
        showToast('File System Access API is not supported in this browser. Please use Chrome, Edge, Safari, or Opera.', 'error');
        return;
    }

    try {
        const dirHandle = await window.showDirectoryPicker({
            mode: 'readwrite'
        });

        CMSState.dirHandle = dirHandle;
        updateWorkspaceStatus(true, dirHandle.name);
        
        showToast(`Workspace folder '${dirHandle.name}' connected! Loading files...`, 'success');
        await loadAllWorkspaceFiles();
    } catch (err) {
        if (err.name !== 'AbortError') {
            console.error('Error selecting directory:', err);
            showToast('Failed to access folder: ' + err.message, 'error');
        }
    }
}

function updateWorkspaceStatus(connected, folderName = '') {
    const dot = document.getElementById('status-dot');
    const text = document.getElementById('status-text');
    
    if (connected) {
        dot.classList.add('connected');
        text.innerText = `Linked: ${folderName}`;
        document.getElementById('btn-select-dir').innerHTML = `<i class="fas fa-folder-check"></i> ${folderName}`;
    } else {
        dot.classList.remove('connected');
        text.innerText = 'Not Connected';
        document.getElementById('btn-select-dir').innerHTML = `<i class="fas fa-folder-open"></i> Select Repo Folder`;
    }
}

// Attempt auto loading if files are accessible or read from local disk
async function attemptAutoDetectOrInit() {
    if (!isFileSystemAccessSupported()) {
        showToast('Note: Use Chrome/Edge for direct disk saving support.', 'warning');
    }
}

// Load Files from Workspace Directory
async function loadAllWorkspaceFiles() {
    if (!CMSState.dirHandle) return;

    try {
        // Required files to parse
        const targetFiles = [
            'index.html',
            'publications.html',
            'projects.html',
            'fieldworks.html',
            'teaching.html',
            'contact.html',
            'js/components.js'
        ];

        for (const fileRelPath of targetFiles) {
            try {
                let fileHandle;
                if (fileRelPath.includes('/')) {
                    const parts = fileRelPath.split('/');
                    const subDir = await CMSState.dirHandle.getDirectoryHandle(parts[0]);
                    fileHandle = await subDir.getFileHandle(parts[1]);
                } else {
                    fileHandle = await CMSState.dirHandle.getFileHandle(fileRelPath);
                }

                const file = await fileHandle.getFile();
                const text = await file.text();
                CMSState.files[fileRelPath] = { handle: fileHandle, content: text };
            } catch (e) {
                console.warn(`Could not load ${fileRelPath}:`, e);
            }
        }

        // Parse Loaded Files into Data Models
        parseAllFiles();
        renderAllForms();
        showToast('All portfolio pages loaded successfully!', 'success');
    } catch (err) {
        console.error('Error loading files:', err);
        showToast('Error reading files: ' + err.message, 'error');
    }
}

// ----------------------------------------------------
// 2. PARSING LOGIC (HTML DOM Parser)
// ----------------------------------------------------
function parseAllFiles() {
    const parser = new DOMParser();

    // 2.1 Parse js/components.js
    if (CMSState.files['js/components.js']) {
        const jsText = CMSState.files['js/components.js'].content;
        
        // Extract Sidebar details
        const sidebarMatch = jsText.match(/sidebar\.innerHTML\s*=\s*`([\s\S]*?)`;/);
        if (sidebarMatch) {
            const sidebarHtml = sidebarMatch[1];
            const doc = parser.parseFromString(sidebarHtml, 'text/html');

            const nameEl = doc.querySelector('h1');
            const roleEl = doc.querySelector('p');
            const imgEl = doc.querySelector('.profile-img');

            if (nameEl) CMSState.data.components.name = nameEl.innerText.trim();
            if (roleEl) CMSState.data.components.role = roleEl.innerHTML.trim();
            if (imgEl) CMSState.data.components.avatar = imgEl.getAttribute('src') || '';

            const socialLinks = [];
            doc.querySelectorAll('.social-links li a').forEach(a => {
                const icon = a.querySelector('i');
                const iconClass = icon ? icon.className : 'fas fa-link';
                const href = a.getAttribute('href') || '#';
                const label = a.innerText.trim();
                socialLinks.push({ label, href, iconClass });
            });
            CMSState.data.components.socials = socialLinks;
        }
    }

    // 2.2 Parse index.html
    if (CMSState.files['index.html']) {
        const doc = parser.parseFromString(CMSState.files['index.html'].content, 'text/html');

        // About section
        const aboutSec = doc.getElementById('about');
        if (aboutSec) {
            CMSState.data.index.about = Array.from(aboutSec.querySelectorAll('p')).map(p => p.innerHTML.trim());
        }

        // Key Areas section
        const keySec = doc.getElementById('key-areas');
        if (keySec) {
            CMSState.data.index.keyAreas = Array.from(keySec.querySelectorAll('li')).map(li => li.innerText.trim());
        }

        // Education section
        const eduSec = doc.getElementById('education');
        if (eduSec) {
            CMSState.data.index.education = Array.from(eduSec.querySelectorAll('.experience-item')).map(item => {
                const title = item.querySelector('.item-title')?.innerText.trim() || '';
                const meta = item.querySelector('.item-meta')?.innerText.trim() || '';
                const paras = Array.from(item.querySelectorAll('p')).map(p => p.innerHTML.trim());
                return { title, meta, paragraphs: paras };
            });
        }

        // Conferences
        const confSec = doc.getElementById('conferences');
        if (confSec) {
            CMSState.data.index.conferences = Array.from(confSec.querySelectorAll('.experience-item')).map(item => {
                const title = item.querySelector('.item-title')?.innerText.trim() || '';
                const desc = item.querySelector('p')?.innerHTML.trim() || '';
                return { title, description: desc };
            });
        }

        // Awards
        const awardsSec = doc.getElementById('awards');
        if (awardsSec) {
            CMSState.data.index.awards = Array.from(awardsSec.querySelectorAll('li')).map(li => li.innerHTML.trim());
        }

        // Affiliations
        const affSec = doc.getElementById('affiliations');
        if (affSec) {
            CMSState.data.index.affiliations = Array.from(affSec.querySelectorAll('li')).map(li => li.innerHTML.trim());
        }
    }

    // 2.3 Parse publications.html
    if (CMSState.files['publications.html']) {
        const doc = parser.parseFromString(CMSState.files['publications.html'].content, 'text/html');
        const pubSec = doc.getElementById('publications');
        if (pubSec) {
            CMSState.data.publications.items = Array.from(pubSec.querySelectorAll('.publication-item')).map(item => {
                const title = item.querySelector('.item-title')?.innerText.trim() || '';
                const meta = item.querySelector('.item-meta')?.innerText.trim() || '';
                return { title, meta };
            });

            const noteEl = pubSec.querySelector('p em');
            if (noteEl) CMSState.data.publications.note = noteEl.innerText.trim();
        }
    }

    // 2.4 Parse projects.html
    if (CMSState.files['projects.html']) {
        const doc = parser.parseFromString(CMSState.files['projects.html'].content, 'text/html');
        const projSec = doc.getElementById('projects');
        if (projSec) {
            const children = Array.from(projSec.children);
            let currentCategory = 'current';

            CMSState.data.projects.current = [];
            CMSState.data.projects.past = [];

            children.forEach(child => {
                if (child.tagName === 'H2') {
                    if (child.innerText.toLowerCase().includes('past')) {
                        currentCategory = 'past';
                    } else {
                        currentCategory = 'current';
                    }
                } else if (child.classList.contains('project-item')) {
                    const title = child.querySelector('.item-title')?.innerText.trim() || '';
                    const meta = child.querySelector('.item-meta')?.innerText.trim() || '';
                    const desc = child.querySelector('p')?.innerHTML.trim() || '';
                    
                    const projectObj = { title, meta, description: desc };
                    if (currentCategory === 'current') {
                        CMSState.data.projects.current.push(projectObj);
                    } else {
                        CMSState.data.projects.past.push(projectObj);
                    }
                }
            });
        }
    }

    // 2.5 Parse fieldworks.html
    if (CMSState.files['fieldworks.html']) {
        const doc = parser.parseFromString(CMSState.files['fieldworks.html'].content, 'text/html');
        const fwSec = doc.getElementById('field-works');
        if (fwSec) {
            const h2 = fwSec.querySelector('h2');
            const p = fwSec.querySelector('p');
            if (h2) CMSState.data.fieldworks.heading = h2.innerText.trim();
            if (p) CMSState.data.fieldworks.description = p.innerHTML.trim();
        }
    }

    // 2.6 Parse teaching.html
    if (CMSState.files['teaching.html']) {
        const doc = parser.parseFromString(CMSState.files['teaching.html'].content, 'text/html');
        const teachSec = doc.getElementById('teaching');
        if (teachSec) {
            CMSState.data.teaching.experiences = [];
            CMSState.data.teaching.trainings = [];

            let currentCategory = 'experiences';
            Array.from(teachSec.children).forEach(child => {
                if (child.tagName === 'H2') {
                    if (child.innerText.toLowerCase().includes('training')) {
                        currentCategory = 'trainings';
                    } else {
                        currentCategory = 'experiences';
                    }
                } else if (child.classList.contains('experience-item')) {
                    const title = child.querySelector('.item-title')?.innerText.trim() || '';
                    const meta = child.querySelector('.item-meta')?.innerText.trim() || '';
                    
                    if (currentCategory === 'experiences') {
                        const bullets = Array.from(child.querySelectorAll('ul li')).map(li => li.innerHTML.trim());
                        const pText = child.querySelector('p')?.innerHTML.trim() || '';
                        CMSState.data.teaching.experiences.push({ title, meta, bullets, description: pText });
                    } else {
                        const desc = child.querySelector('p')?.innerHTML.trim() || '';
                        CMSState.data.teaching.trainings.push({ title, meta, description: desc });
                    }
                }
            });
        }
    }

    // 2.7 Parse contact.html
    if (CMSState.files['contact.html']) {
        const doc = parser.parseFromString(CMSState.files['contact.html'].content, 'text/html');
        const contactSec = doc.getElementById('contact');
        if (contactSec) {
            const pIntro = contactSec.querySelector('p');
            if (pIntro) CMSState.data.contact.intro = pIntro.innerHTML.trim();

            const emailLink = contactSec.querySelector('a[href^="mailto:"]');
            if (emailLink) CMSState.data.contact.email = emailLink.innerText.trim();
        }
    }
}

// ----------------------------------------------------
// 3. RENDER UI FORMS
// ----------------------------------------------------
function renderAllForms() {
    renderStats();
    renderSidebarForm();
    renderHomeForm();
    renderPublicationsForm();
    renderProjectsForm();
    renderFieldworksForm();
    renderTeachingForm();
    renderContactForm();
}

function renderStats() {
    document.getElementById('stat-publications').innerText = CMSState.data.publications.items.length;
    document.getElementById('stat-projects').innerText = CMSState.data.projects.current.length + CMSState.data.projects.past.length;
    document.getElementById('stat-education').innerText = CMSState.data.index.education.length;
}

// Render Settings & Sidebar Form
function renderSidebarForm() {
    const c = CMSState.data.components;
    document.getElementById('sidebar-name').value = c.name || '';
    document.getElementById('sidebar-role').value = c.role.replace(/<br\s*\/?>/gi, '\n') || '';
    document.getElementById('sidebar-avatar').value = c.avatar || '';

    const socialsContainer = document.getElementById('sidebar-socials-list');
    socialsContainer.innerHTML = '';

    c.socials.forEach((social, idx) => {
        const div = document.createElement('div');
        div.className = 'item-card';
        div.innerHTML = `
            <div class="item-card-header">
                <span class="item-card-title">Link #${idx + 1}: ${social.label}</span>
                <button class="btn btn-sm btn-danger btn-icon-only" onclick="removeSocial(${idx})"><i class="fas fa-trash"></i></button>
            </div>
            <div class="form-group">
                <label class="form-label">Label</label>
                <input type="text" class="form-control" value="${social.label}" onchange="updateSocial(${idx}, 'label', this.value)">
            </div>
            <div class="form-group">
                <label class="form-label">URL / Href</label>
                <input type="text" class="form-control" value="${social.href}" onchange="updateSocial(${idx}, 'href', this.value)">
            </div>
            <div class="form-group">
                <label class="form-label">Icon Class (FontAwesome)</label>
                <input type="text" class="form-control" value="${social.iconClass}" onchange="updateSocial(${idx}, 'iconClass', this.value)">
            </div>
        `;
        socialsContainer.appendChild(div);
    });
}

function updateSocial(index, key, value) {
    CMSState.data.components.socials[index][key] = value;
}

function removeSocial(index) {
    CMSState.data.components.socials.splice(index, 1);
    renderSidebarForm();
}

function addSocialLink() {
    CMSState.data.components.socials.push({
        label: 'New Link',
        href: '#',
        iconClass: 'fas fa-link'
    });
    renderSidebarForm();
}

// Render Home Form
function renderHomeForm() {
    // About Paragraphs
    const aboutList = document.getElementById('home-about-list');
    aboutList.innerHTML = '';
    CMSState.data.index.about.forEach((para, idx) => {
        const div = document.createElement('div');
        div.className = 'form-group';
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                <label class="form-label">Paragraph #${idx + 1}</label>
                <button class="btn btn-sm btn-danger btn-icon-only" onclick="removeAboutPara(${idx})"><i class="fas fa-trash"></i></button>
            </div>
            <textarea class="form-control" rows="3" onchange="updateAboutPara(${idx}, this.value)">${para}</textarea>
        `;
        aboutList.appendChild(div);
    });

    // Key Areas
    const keyContainer = document.getElementById('home-key-areas');
    keyContainer.value = CMSState.data.index.keyAreas.join('\n');

    // Education
    const eduList = document.getElementById('home-education-list');
    eduList.innerHTML = '';
    CMSState.data.index.education.forEach((edu, idx) => {
        const div = document.createElement('div');
        div.className = 'item-card';
        div.innerHTML = `
            <div class="item-card-header">
                <span class="item-card-title">${edu.title || 'Degree'}</span>
                <button class="btn btn-sm btn-danger btn-icon-only" onclick="removeEducation(${idx})"><i class="fas fa-trash"></i></button>
            </div>
            <div class="form-group">
                <label class="form-label">Degree & Year</label>
                <input type="text" class="form-control" value="${edu.title}" onchange="CMSState.data.index.education[${idx}].title = this.value">
            </div>
            <div class="form-group">
                <label class="form-label">Institution & Country</label>
                <input type="text" class="form-control" value="${edu.meta}" onchange="CMSState.data.index.education[${idx}].meta = this.value">
            </div>
            <div class="form-group">
                <label class="form-label">Details / Topics (One line per entry)</label>
                <textarea class="form-control" rows="2" onchange="updateEduParas(${idx}, this.value)">${edu.paragraphs ? edu.paragraphs.join('\n') : ''}</textarea>
            </div>
        `;
        eduList.appendChild(div);
    });

    // Conferences
    const confList = document.getElementById('home-conferences-list');
    confList.innerHTML = '';
    CMSState.data.index.conferences.forEach((conf, idx) => {
        const div = document.createElement('div');
        div.className = 'item-card';
        div.innerHTML = `
            <div class="item-card-header">
                <span class="item-card-title">${conf.title || 'Conference'}</span>
                <button class="btn btn-sm btn-danger btn-icon-only" onclick="removeConference(${idx})"><i class="fas fa-trash"></i></button>
            </div>
            <div class="form-group">
                <label class="form-label">Conference Title</label>
                <input type="text" class="form-control" value="${conf.title}" onchange="CMSState.data.index.conferences[${idx}].title = this.value">
            </div>
            <div class="form-group">
                <label class="form-label">Presentation Details & Location</label>
                <textarea class="form-control" rows="2" onchange="CMSState.data.index.conferences[${idx}].description = this.value">${conf.description}</textarea>
            </div>
        `;
        confList.appendChild(div);
    });

    // Awards
    document.getElementById('home-awards').value = CMSState.data.index.awards.join('\n');

    // Affiliations
    document.getElementById('home-affiliations').value = CMSState.data.index.affiliations.join('\n');
}

function updateAboutPara(idx, val) { CMSState.data.index.about[idx] = val; }
function removeAboutPara(idx) { CMSState.data.index.about.splice(idx, 1); renderHomeForm(); }
function addAboutPara() { CMSState.data.index.about.push('New paragraph text...'); renderHomeForm(); }

function updateEduParas(idx, text) {
    CMSState.data.index.education[idx].paragraphs = text.split('\n').filter(l => l.trim() !== '');
}
function removeEducation(idx) { CMSState.data.index.education.splice(idx, 1); renderHomeForm(); }
function addEducationItem() {
    CMSState.data.index.education.push({ title: 'New Degree (Year)', meta: 'University, Country', paragraphs: [] });
    renderHomeForm();
}

function removeConference(idx) { CMSState.data.index.conferences.splice(idx, 1); renderHomeForm(); }
function addConferenceItem() {
    CMSState.data.index.conferences.push({ title: 'Conference Name', description: 'Presentation details...' });
    renderHomeForm();
}

// Render Publications Form
function renderPublicationsForm() {
    const container = document.getElementById('publications-list');
    container.innerHTML = '';

    CMSState.data.publications.items.forEach((pub, idx) => {
        const div = document.createElement('div');
        div.className = 'item-card';
        div.innerHTML = `
            <div class="item-card-header">
                <span class="item-card-title">Article #${idx + 1}</span>
                <div class="item-actions">
                    <button class="btn btn-sm btn-secondary btn-icon-only" onclick="movePublication(${idx}, -1)"><i class="fas fa-arrow-up"></i></button>
                    <button class="btn btn-sm btn-secondary btn-icon-only" onclick="movePublication(${idx}, 1)"><i class="fas fa-arrow-down"></i></button>
                    <button class="btn btn-sm btn-danger btn-icon-only" onclick="removePublication(${idx})"><i class="fas fa-trash"></i></button>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">Article Title</label>
                <input type="text" class="form-control" value="${pub.title}" onchange="CMSState.data.publications.items[${idx}].title = this.value">
            </div>
            <div class="form-group">
                <label class="form-label">Authors & Journal Metadata</label>
                <input type="text" class="form-control" value="${pub.meta}" onchange="CMSState.data.publications.items[${idx}].meta = this.value">
            </div>
        `;
        container.appendChild(div);
    });

    document.getElementById('publications-note').value = CMSState.data.publications.note || '';
}

function removePublication(idx) { CMSState.data.publications.items.splice(idx, 1); renderPublicationsForm(); renderStats(); }
function movePublication(idx, dir) {
    const arr = CMSState.data.publications.items;
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= arr.length) return;
    const temp = arr[idx];
    arr[idx] = arr[targetIdx];
    arr[targetIdx] = temp;
    renderPublicationsForm();
}
function addPublicationItem() {
    CMSState.data.publications.items.unshift({ title: 'New Article Title', meta: 'Author, A. B. 2025. Journal Name, 12, 100.' });
    renderPublicationsForm();
    renderStats();
}

// Render Projects Form
function renderProjectsForm() {
    const currContainer = document.getElementById('projects-current-list');
    currContainer.innerHTML = '';
    CMSState.data.projects.current.forEach((proj, idx) => {
        currContainer.appendChild(createProjectCard(proj, idx, 'current'));
    });

    const pastContainer = document.getElementById('projects-past-list');
    pastContainer.innerHTML = '';
    CMSState.data.projects.past.forEach((proj, idx) => {
        pastContainer.appendChild(createProjectCard(proj, idx, 'past'));
    });
}

function createProjectCard(proj, idx, cat) {
    const div = document.createElement('div');
    div.className = 'item-card';
    div.innerHTML = `
        <div class="item-card-header">
            <span class="item-card-title">${proj.title || 'Project Title'}</span>
            <button class="btn btn-sm btn-danger btn-icon-only" onclick="removeProject('${cat}', ${idx})"><i class="fas fa-trash"></i></button>
        </div>
        <div class="form-group">
            <label class="form-label">Project Name</label>
            <input type="text" class="form-control" value="${proj.title}" onchange="CMSState.data.projects.${cat}[${idx}].title = this.value">
        </div>
        <div class="form-group">
            <label class="form-label">Role & Funder Metadata</label>
            <input type="text" class="form-control" value="${proj.meta}" onchange="CMSState.data.projects.${cat}[${idx}].meta = this.value">
        </div>
        <div class="form-group">
            <label class="form-label">Short Description (Optional)</label>
            <textarea class="form-control" rows="2" onchange="CMSState.data.projects.${cat}[${idx}].description = this.value">${proj.description || ''}</textarea>
        </div>
    `;
    return div;
}

function removeProject(cat, idx) {
    CMSState.data.projects[cat].splice(idx, 1);
    renderProjectsForm();
    renderStats();
}
function addProjectItem(cat) {
    CMSState.data.projects[cat].unshift({ title: 'New Project Title', meta: 'Role: Principal Investigator | Funded by: Cell', description: '' });
    renderProjectsForm();
    renderStats();
}

// Render Fieldworks Form
function renderFieldworksForm() {
    document.getElementById('fieldworks-heading').value = CMSState.data.fieldworks.heading || 'Field Works';
    document.getElementById('fieldworks-desc').value = CMSState.data.fieldworks.description || '';
}

// Render Teaching Form
function renderTeachingForm() {
    const expContainer = document.getElementById('teaching-experiences-list');
    expContainer.innerHTML = '';
    CMSState.data.teaching.experiences.forEach((exp, idx) => {
        const div = document.createElement('div');
        div.className = 'item-card';
        div.innerHTML = `
            <div class="item-card-header">
                <span class="item-card-title">${exp.title}</span>
                <button class="btn btn-sm btn-danger btn-icon-only" onclick="removeTeachingExp(${idx})"><i class="fas fa-trash"></i></button>
            </div>
            <div class="form-group">
                <label class="form-label">Position Title & Dates</label>
                <input type="text" class="form-control" value="${exp.title}" onchange="CMSState.data.teaching.experiences[${idx}].title = this.value">
            </div>
            <div class="form-group">
                <label class="form-label">Institution / Location</label>
                <input type="text" class="form-control" value="${exp.meta}" onchange="CMSState.data.teaching.experiences[${idx}].meta = this.value">
            </div>
            <div class="form-group">
                <label class="form-label">Bullet Duties (One line per bullet, optional)</label>
                <textarea class="form-control" rows="3" onchange="updateTeachingBullets(${idx}, this.value)">${exp.bullets ? exp.bullets.join('\n') : ''}</textarea>
            </div>
            <div class="form-group">
                <label class="form-label">Summary Paragraph (Optional)</label>
                <input type="text" class="form-control" value="${exp.description || ''}" onchange="CMSState.data.teaching.experiences[${idx}].description = this.value">
            </div>
        `;
        expContainer.appendChild(div);
    });

    const trainContainer = document.getElementById('teaching-trainings-list');
    trainContainer.innerHTML = '';
    CMSState.data.teaching.trainings.forEach((tr, idx) => {
        const div = document.createElement('div');
        div.className = 'item-card';
        div.innerHTML = `
            <div class="item-card-header">
                <span class="item-card-title">${tr.title}</span>
                <button class="btn btn-sm btn-danger btn-icon-only" onclick="removeTeachingTraining(${idx})"><i class="fas fa-trash"></i></button>
            </div>
            <div class="form-group">
                <label class="form-label">Training Topic</label>
                <input type="text" class="form-control" value="${tr.title}" onchange="CMSState.data.teaching.trainings[${idx}].title = this.value">
            </div>
            <div class="form-group">
                <label class="form-label">Date & Funder</label>
                <input type="text" class="form-control" value="${tr.meta}" onchange="CMSState.data.teaching.trainings[${idx}].meta = this.value">
            </div>
            <div class="form-group">
                <label class="form-label">Description</label>
                <textarea class="form-control" rows="2" onchange="CMSState.data.teaching.trainings[${idx}].description = this.value">${tr.description || ''}</textarea>
            </div>
        `;
        trainContainer.appendChild(div);
    });
}

function updateTeachingBullets(idx, val) {
    CMSState.data.teaching.experiences[idx].bullets = val.split('\n').filter(b => b.trim() !== '');
}
function removeTeachingExp(idx) { CMSState.data.teaching.experiences.splice(idx, 1); renderTeachingForm(); }
function addTeachingExp() {
    CMSState.data.teaching.experiences.push({ title: 'Position Title', meta: 'Institution Name', bullets: [], description: '' });
    renderTeachingForm();
}

function removeTeachingTraining(idx) { CMSState.data.teaching.trainings.splice(idx, 1); renderTeachingForm(); }
function addTeachingTraining() {
    CMSState.data.teaching.trainings.push({ title: 'Training Topic', meta: 'Year | Funder', description: 'Summary of training...' });
    renderTeachingForm();
}

// Render Contact Form
function renderContactForm() {
    document.getElementById('contact-intro').value = CMSState.data.contact.intro || '';
    document.getElementById('contact-email').value = CMSState.data.contact.email || '';
}

// ----------------------------------------------------
// 4. SAVE & SERIALIZATION LOGIC
// ----------------------------------------------------
async function saveAllFiles() {
    if (!CMSState.dirHandle) {
        showToast('Please select your workspace repository folder first!', 'warning');
        return;
    }

    try {
        // Collect form data back into state
        syncFormValuesToState();

        // Regenerate Content
        const newComponentsJs = generateComponentsJs();
        const newIndexHtml = generateIndexHtml();
        const newPublicationsHtml = generatePublicationsHtml();
        const newProjectsHtml = generateProjectsHtml();
        const newFieldworksHtml = generateFieldworksHtml();
        const newTeachingHtml = generateTeachingHtml();
        const newContactHtml = generateContactHtml();

        // Write directly to Disk files via Handles
        await writeFileHandle('js/components.js', newComponentsJs);
        await writeFileHandle('index.html', newIndexHtml);
        await writeFileHandle('publications.html', newPublicationsHtml);
        await writeFileHandle('projects.html', newProjectsHtml);
        await writeFileHandle('fieldworks.html', newFieldworksHtml);
        await writeFileHandle('teaching.html', newTeachingHtml);
        await writeFileHandle('contact.html', newContactHtml);

        showToast('All static HTML & JS files successfully saved to disk!', 'success');
    } catch (err) {
        console.error('Error saving files:', err);
        showToast('Save failed: ' + err.message, 'error');
    }
}

function syncFormValuesToState() {
    // Sync Settings / Sidebar
    CMSState.data.components.name = document.getElementById('sidebar-name').value;
    CMSState.data.components.role = document.getElementById('sidebar-role').value;
    CMSState.data.components.avatar = document.getElementById('sidebar-avatar').value;

    // Sync Home Key Areas
    const keyText = document.getElementById('home-key-areas').value;
    CMSState.data.index.keyAreas = keyText.split('\n').filter(k => k.trim() !== '');

    // Sync Awards & Affiliations
    CMSState.data.index.awards = document.getElementById('home-awards').value.split('\n').filter(a => a.trim() !== '');
    CMSState.data.index.affiliations = document.getElementById('home-affiliations').value.split('\n').filter(a => a.trim() !== '');

    // Sync Publications Note
    CMSState.data.publications.note = document.getElementById('publications-note').value;

    // Sync Field Works
    CMSState.data.fieldworks.heading = document.getElementById('fieldworks-heading').value;
    CMSState.data.fieldworks.description = document.getElementById('fieldworks-desc').value;

    // Sync Contact
    CMSState.data.contact.intro = document.getElementById('contact-intro').value;
    CMSState.data.contact.email = document.getElementById('contact-email').value;
}

async function writeFileHandle(relPath, content) {
    let fileHandle;
    if (relPath.includes('/')) {
        const parts = relPath.split('/');
        const subDir = await CMSState.dirHandle.getDirectoryHandle(parts[0], { create: true });
        fileHandle = await subDir.getFileHandle(parts[1], { create: true });
    } else {
        fileHandle = await CMSState.dirHandle.getFileHandle(relPath, { create: true });
    }

    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();

    // Cache content
    CMSState.files[relPath] = { handle: fileHandle, content: content };
}

// ----------------------------------------------------
// 5. HTML & JS CODE GENERATORS
// ----------------------------------------------------
function generateComponentsJs() {
    const c = CMSState.data.components;
    const formattedRole = c.role.replace(/\n/g, '<br>');

    const socialsHtml = c.socials.map(s => {
        return `                <li><a href="${s.href}" target="_blank"><i class="${s.iconClass}"></i> ${s.label}</a></li>`;
    }).join('\n');

    return `document.addEventListener('DOMContentLoaded', function() {
    initNavigation();
    initSidebar();
    initFooter();
});

function initNavigation() {
    const header = document.getElementById('header-placeholder');
    if (!header) return;

    const currentPage = window.location.pathname.split("/").pop() || 'index.html';

    header.innerHTML = \`
        <header>
            <div class="container">
                <nav>
                    <div class="header-name">
                        <a href="index.html">${c.name || 'Dr. Md. Saidur Rahman'}</a>
                    </div>
                    <button id="menu-toggle" class="menu-toggle">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>
                    <ul id="nav-menu">
                        <li><a href="index.html" class="\${currentPage === 'index.html' ? 'active' : ''}">Home</a></li>
                        <li><a href="publications.html" class="\${currentPage === 'publications.html' ? 'active' : ''}">Publications</a></li>
                        <li><a href="projects.html" class="\${currentPage === 'projects.html' ? 'active' : ''}">Projects</a></li>
                        <li><a href="fieldworks.html" class="\${currentPage === 'fieldworks.html' ? 'active' : ''}">Field Works</a></li>
                        <li><a href="teaching.html" class="\${currentPage === 'teaching.html' ? 'active' : ''}">Teaching</a></li>
                        <li><a href="contact.html" class="\${currentPage === 'contact.html' ? 'active' : ''}">Contact</a></li>
                        <li><a href="CV/CV_Saidur_Rahman_UK1.pdf" target="_blank" class="cv-link">CV</a></li>
                    </ul>
                </nav>
            </div>
        </header>
    \`;

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

    sidebar.innerHTML = \`
        <div class="sidebar">
            <img src="${c.avatar || 'photo/profile.jpg'}" alt="${c.name || 'Profile'}" class="profile-img">
            <h1>${c.name || ''}</h1>
            <p>${formattedRole}</p>
            
            <ul class="social-links">
${socialsHtml}
            </ul>
        </div>
    \`;
}

function initFooter() {
    const footer = document.getElementById('footer-placeholder');
    if (!footer) return;

    footer.innerHTML = \`
        <footer>
            <div class="container">
                <p>&copy; \${new Date().getFullYear()} ${c.name || 'Dr. Md. Saidur Rahman'}. All rights reserved.</p>
                <p>Professor, Khulna University, Bangladesh</p>
            </div>
        </footer>
    \`;
}
`;
}

function generateIndexHtml() {
    const idx = CMSState.data.index;

    const aboutParas = idx.about.map(p => `                    <p>${p}</p>`).join('\n');
    const keyList = idx.keyAreas.map(k => `                        <li>${k}</li>`).join('\n');

    const eduHtml = idx.education.map(e => {
        let pContent = '';
        if (e.paragraphs && e.paragraphs.length > 0) {
            pContent = e.paragraphs.map(p => `                        <p>${p}</p>`).join('\n');
        }
        return `                    <div class="experience-item">
                        <span class="item-title">${e.title}</span>
                        <span class="item-meta">${e.meta}</span>
${pContent}
                    </div>`;
    }).join('\n');

    const confHtml = idx.conferences.map(c => {
        return `                    <div class="experience-item">
                        <span class="item-title">${c.title}</span>
                        <p>${c.description}</p>
                    </div>`;
    }).join('\n');

    const awardsHtml = idx.awards.map(a => `                        <li>${a}</li>`).join('\n');
    const affHtml = idx.affiliations.map(af => `                        <li>${af}</li>`).join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="Portfolio of Dr. Md. Saidur Rahman, Professor of Forestry and Wood Technology at Khulna University, Bangladesh. Specialist in mangrove ecology and management.">
    <meta name="keywords" content="Dr. Md. Saidur Rahman, Khulna University, Forestry, Mangrove Ecology, Remote Sensing, GIS, Carbon Inventory, Bangladesh">
    <meta name="author" content="${CMSState.data.components.name || 'Dr. Md. Saidur Rahman'}">
    <title>${CMSState.data.components.name || 'Dr. Md. Saidur Rahman'} | Home</title>
    
    <!-- Favicon -->
    <link rel="icon" type="image/svg+xml" href="assets/favicon.svg">
    
    <!-- CSS -->
    <link rel="stylesheet" href="css/styles.css">
    <!-- FontAwesome -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
</head>
<body>
    <div id="header-placeholder"></div>

    <div class="hero">
        <div class="container"></div>
    </div>

    <main class="container">
        <div class="main-layout">
            <div id="sidebar-placeholder"></div>

            <div class="content-area">
                <section id="about">
                    <h2>About Myself</h2>
${aboutParas}
                </section>

                <section id="key-areas">
                    <h2>Key Areas of Expertise </h2>
                    <ul>
${keyList}
                    </ul>
                </section>

                <section id="education">
                    <h2>Education</h2>
${eduHtml}
                </section>

                <section id="conferences">
                    <h2>Conferences</h2>
${confHtml}
                </section>

                <section id="awards">
                    <h2>Awards, Scholarships and Prizes</h2>
                    <ul>
${awardsHtml}
                    </ul>
                </section>

                <section id="affiliations">
                    <h2>Professional Affiliations</h2>
                    <ul>
${affHtml}
                    </ul>
                </section>
            </div>
        </div>
    </main>

    <div id="footer-placeholder"></div>

    <!-- JS -->
    <script src="js/components.js"></script>
</body>
</html>
`;
}

function generatePublicationsHtml() {
    const pub = CMSState.data.publications;

    const itemsHtml = pub.items.map(p => {
        return `                    <div class="publication-item">
                        <span class="item-title">${p.title}</span>
                        <span class="item-meta">${p.meta}</span>
                    </div>`;
    }).join('\n\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="Publications and Journal Articles of Dr. Md. Saidur Rahman. Specialist in mangrove ecology and remote sensing.">
    <title>Publications | ${CMSState.data.components.name || 'Dr. Md. Saidur Rahman'}</title>
    <link rel="icon" type="image/svg+xml" href="assets/favicon.svg">
    <link rel="stylesheet" href="css/styles.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
</head>
<body>
    <div id="header-placeholder"></div>
    <div class="hero"></div>

    <main class="container">
        <div class="main-layout">
            <div id="sidebar-placeholder"></div>

            <div class="content-area">
                <section id="publications">
                    <h2>Journal Articles</h2>
                    
${itemsHtml}

                    <p><em>${pub.note || 'Note: This is a selected list of publications.'}</em></p>
                </section>
            </div>
        </div>
    </main>

    <div id="footer-placeholder"></div>
    <script src="js/components.js"></script>
</body>
</html>
`;
}

function generateProjectsHtml() {
    const proj = CMSState.data.projects;

    const currHtml = proj.current.map(p => {
        const descHtml = p.description ? `\n                        <p>${p.description}</p>` : '';
        return `                    <div class="project-item">
                        <span class="item-title">${p.title}</span>
                        <span class="item-meta">${p.meta}</span>${descHtml}
                    </div>`;
    }).join('\n\n');

    const pastHtml = proj.past.map(p => {
        const descHtml = p.description ? `\n                        <p>${p.description}</p>` : '';
        return `                    <div class="project-item">
                        <span class="item-title">${p.title}</span>
                        <span class="item-meta">${p.meta}</span>${descHtml}
                    </div>`;
    }).join('\n\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="Research projects and experiences of Dr. Md. Saidur Rahman. Focus on mangrove restoration and climate change adaptation.">
    <title>Projects | ${CMSState.data.components.name || 'Dr. Md. Saidur Rahman'}</title>
    <link rel="icon" type="image/svg+xml" href="assets/favicon.svg">
    <link rel="stylesheet" href="css/styles.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
</head>
<body>
    <div id="header-placeholder"></div>
    <div class="hero"></div>

    <main class="container">
        <div class="main-layout">
            <div id="sidebar-placeholder"></div>

            <div class="content-area">
                <section id="projects">
                    <h2>Current Research Projects</h2>
                    
${currHtml}

                    <h2>Past Research Projects</h2>

${pastHtml}
                </section>
            </div>
        </div>
    </main>

    <div id="footer-placeholder"></div>
    <script src="js/components.js"></script>
</body>
</html>
`;
}

function generateFieldworksHtml() {
    const fw = CMSState.data.fieldworks;
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="Field works and ecological surveys conducted by Dr. Md. Saidur Rahman.">
    <title>Field Works | ${CMSState.data.components.name || 'Dr. Md. Saidur Rahman'}</title>
    <link rel="icon" type="image/svg+xml" href="assets/favicon.svg">
    <link rel="stylesheet" href="css/styles.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
</head>
<body>
    <div id="header-placeholder"></div>
    <div class="hero"></div>

    <main class="container">
        <div class="main-layout">
            <div id="sidebar-placeholder"></div>

            <div class="content-area">
                <section id="field-works">
                    <h2>${fw.heading || 'Field Works'}</h2>
                    <p>${fw.description || 'Information about field works, ecological surveys, and site visits will be updated soon.'}</p>
                    <div style="height: 300px; background-color: #f9f9f9; border: 2px dashed #ccc; display: flex; align-items: center; justify-content: center; margin-top: 20px;">
                        <span style="color: #999;">Gallery coming soon...</span>
                    </div>
                </section>
            </div>
        </div>
    </main>

    <div id="footer-placeholder"></div>
    <script src="js/components.js"></script>
</body>
</html>
`;
}

function generateTeachingHtml() {
    const t = CMSState.data.teaching;

    const expHtml = t.experiences.map(e => {
        let listItems = '';
        if (e.bullets && e.bullets.length > 0) {
            listItems = `\n                        <ul>\n` + e.bullets.map(b => `                            <li>${b}</li>`).join('\n') + `\n                        </ul>`;
        }
        let descP = e.description ? `\n                        <p>${e.description}</p>` : '';

        return `                    <div class="experience-item">
                        <span class="item-title">${e.title}</span>
                        <span class="item-meta">${e.meta}</span>${listItems}${descP}
                    </div>`;
    }).join('\n\n');

    const trainHtml = t.trainings.map(tr => {
        let descP = tr.description ? `\n                        <p>${tr.description}</p>` : '';
        return `                    <div class="experience-item">
                        <span class="item-title">${tr.title}</span>
                        <span class="item-meta">${tr.meta}</span>${descP}
                    </div>`;
    }).join('\n\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="Teaching experiences, courses, and trainings conducted by Dr. Md. Saidur Rahman at Khulna University.">
    <title>Teaching | ${CMSState.data.components.name || 'Dr. Md. Saidur Rahman'}</title>
    <link rel="icon" type="image/svg+xml" href="assets/favicon.svg">
    <link rel="stylesheet" href="css/styles.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
</head>
<body>
    <div id="header-placeholder"></div>
    <div class="hero"></div>

    <main class="container">
        <div class="main-layout">
            <div id="sidebar-placeholder"></div>

            <div class="content-area">
                <section id="teaching">
                    <h2>Teaching Experiences</h2>
                    
${expHtml}

                    <h2>Trainings Conducted</h2>
${trainHtml}
                </section>
            </div>
        </div>
    </main>

    <div id="footer-placeholder"></div>
    <script src="js/components.js"></script>
</body>
</html>
`;
}

function generateContactHtml() {
    const c = CMSState.data.contact;

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="Contact information for Dr. Md. Saidur Rahman. Get in touch for research collaborations and academic inquiries.">
    <title>Contact | ${CMSState.data.components.name || 'Dr. Md. Saidur Rahman'}</title>
    <link rel="icon" type="image/svg+xml" href="assets/favicon.svg">
    <link rel="stylesheet" href="css/styles.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
</head>
<body>
    <div id="header-placeholder"></div>
    <div class="hero"></div>

    <main class="container">
        <div class="main-layout">
            <div id="sidebar-placeholder"></div>

            <div class="content-area">
                <section id="contact">
                    <h2>Contact Information</h2>
                    <p>${c.intro || 'For research collaborations, academic inquiries, or student supervision, please feel free to reach out via the following channels:'}</p>
                    
                    <div style="margin-top: 30px;">
                        <p><strong><i class="fas fa-envelope" style="color: var(--primary-green); width: 25px;"></i> Email:</strong> <a href="mailto:${c.email}">${c.email}</a></p>
                    </div>
                </section>
            </div>
        </div>
    </main>

    <div id="footer-placeholder"></div>
    <script src="js/components.js"></script>
</body>
</html>
`;
}

// ----------------------------------------------------
// 6. MODALS & UTILITIES
// ----------------------------------------------------
function openPreviewModal() {
    syncFormValuesToState();
    const modal = document.getElementById('modal-preview');
    const frame = document.getElementById('preview-iframe');
    
    // Build preview document in iframe memory
    const previewContent = generateIndexHtml();
    frame.srcdoc = previewContent;
    modal.classList.add('active');
}

function closePreviewModal() {
    document.getElementById('modal-preview').classList.remove('active');
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'toast-error' : (type === 'warning' ? 'toast-warning' : '')}`;
    
    const iconMap = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-triangle-exclamation',
        info: 'fa-info-circle'
    };
    
    toast.innerHTML = `
        <i class="fas ${iconMap[type] || 'fa-info-circle'}"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}
