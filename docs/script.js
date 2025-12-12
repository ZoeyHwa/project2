// Main application
const contentArea = document.getElementById('contentArea');
const noPhotos = document.getElementById('noPhotos');
const readyStatus = document.getElementById('readyStatus');
const notReadyStatus = document.getElementById('notReadyStatus');
const createButton = document.getElementById('createButton');
const refreshButton = document.getElementById('refreshButton');
const photoForm = document.getElementById('photoForm');

// Format date
function formatDate(dateString) {
    if (!dateString) return 'No date';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Get form data
function getFormData() {
    const formData = new FormData(photoForm);
    const data = Object.fromEntries(formData);
    
    if (data.dateTaken) {
        data.dateTaken = new Date(data.dateTaken).toISOString();
    }
    
    return data;
}

// Save photo
async function savePhoto(data) {
    const endpoint = data.id ? `/data/${data.id}` : '/data';
    const method = data.id ? 'PUT' : 'POST';
    
    try {
        const response = await fetch(endpoint, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            const error = await response.json();
            alert(error.error || 'Save failed');
            return;
        }
        
        const result = await response.json();
        console.log('Saved:', result);
        
        // Close modal and reload
        window.upload.closeModalFunc();
        loadPhotos();
        
    } catch (error) {
        console.error('Save error:', error);
        alert('Save failed');
    }
}

// Delete photo
async function deletePhoto(id) {
    if (!confirm('Delete this photo?')) return;
    
    try {
        const response = await fetch(`/data/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('Deleted:', result);
            loadPhotos();
        } else {
            const error = await response.json();
            alert(error.error || 'Delete failed');
        }
    } catch (error) {
        console.error('Delete error:', error);
        alert('Delete failed');
    }
}

// Render photo card
function renderPhotoCard(photo) {
    const div = document.createElement('div');
    div.className = 'photo-card';
    
    const html = `
        ${photo.imageUrl ? `
            <img src="${photo.imageUrl}" alt="${photo.title || 'Photo'}">
        ` : ''}
        <div class="photo-content">
            <h3 class="photo-title">${photo.title || 'Untitled'}</h3>
            <p class="photo-date">${formatDate(photo.dateTaken)}</p>
            ${photo.description ? `
                <p class="photo-description">${photo.description}</p>
            ` : ''}
            <div class="photo-actions">
                <button class="action-btn edit-btn">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="action-btn delete-btn delete">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        </div>
    `;
    
    div.innerHTML = html;
    
    // Add event listeners
    div.querySelector('.edit-btn').addEventListener('click', () => {
        window.upload.openModalForEdit(photo);
    });
    
    div.querySelector('.delete-btn').addEventListener('click', () => {
        deletePhoto(photo.id);
    });
    
    return div;
}

// Load photos
async function loadPhotos() {
    try {
        readyStatus.style.display = 'block';
        notReadyStatus.style.display = 'none';
        
        const response = await fetch('/data');
        
        if (response.ok) {
            const photos = await response.json();
            
            if (photos.length === 0) {
                noPhotos.style.display = 'block';
                contentArea.innerHTML = '';
            } else {
                noPhotos.style.display = 'none';
                contentArea.innerHTML = '';
                
                photos.forEach(photo => {
                    const card = renderPhotoCard(photo);
                    contentArea.appendChild(card);
                });
            }
            
            readyStatus.style.display = 'none';
        } else {
            readyStatus.style.display = 'none';
            notReadyStatus.style.display = 'block';
        }
    } catch (error) {
        console.error('Load error:', error);
        readyStatus.style.display = 'none';
        notReadyStatus.style.display = 'block';
    }
}

// Initialize
function init() {
    // Event listeners
    createButton.addEventListener('click', () => {
        window.upload.openModalForNew();
    });
    
    refreshButton.addEventListener('click', loadPhotos);
    
    photoForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const data = getFormData();
        savePhoto(data);
    });
    
    // Load initial data
    loadPhotos();
}

// Start when page loads
document.addEventListener('DOMContentLoaded', init);