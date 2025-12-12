// Upload functionality
const imagePreview = document.getElementById('imagePreview');
const fileInput = document.getElementById('fileInput');
const uploadArea = document.getElementById('uploadArea');
const noticeArea = document.getElementById('noticeArea');
const browseButton = document.getElementById('browseButton');
const removeImageButton = document.getElementById('removeImageButton');
const modal = document.getElementById('modal');
const closeModal = document.getElementById('closeModal');
const cancelButton = document.getElementById('cancelButton');

// Show notice
function showNotice(message, type = 'error') {
    noticeArea.textContent = message;
    noticeArea.className = 'notice ' + type;
    noticeArea.style.display = 'block';
    
    if (type === 'success') {
        setTimeout(() => {
            noticeArea.style.display = 'none';
        }, 3000);
    }
}

// Update buttons
function updateButtons() {
    const hasImage = document.getElementById('imageUrl').value;
    removeImageButton.style.display = hasImage ? 'flex' : 'none';
    browseButton.textContent = hasImage ? 'Replace' : 'Browse';
}

// Upload file
async function uploadFile(file) {
    // Check file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
        showNotice('File too large. Maximum size is 10MB.');
        return;
    }
    
    // Check file type
    if (!file.type.startsWith('image/')) {
        showNotice('Only image files are allowed.');
        return;
    }
    
    // Show loading
    imagePreview.style.display = 'block';
    imagePreview.src = '';
    noticeArea.style.display = 'none';
    
    // Create form data
    const formData = new FormData();
    formData.append('image', file);
    
    try {
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const error = await response.json();
            showNotice(error.error || 'Upload failed');
            return;
        }
        
        const data = await response.json();
        
        // Update preview
        imagePreview.src = data.url;
        document.getElementById('imageUrl').value = data.url;
        
        updateButtons();
        showNotice('Upload successful!', 'success');
        
    } catch (error) {
        console.error('Upload error:', error);
        showNotice('Upload failed. Please try again.');
    }
}

// Remove image
async function removeImage() {
    const imageUrl = document.getElementById('imageUrl').value;
    
    if (imageUrl) {
        try {
            await fetch('/api/image', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ url: imageUrl })
            });
        } catch (error) {
            console.error('Delete error:', error);
        }
    }
    
    // Reset
    document.getElementById('imageUrl').value = '';
    imagePreview.src = '';
    imagePreview.style.display = 'none';
    fileInput.value = '';
    noticeArea.style.display = 'none';
    updateButtons();
}

// Open modal for new photo
function openModalForNew() {
    document.getElementById('modalTitle').innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Upload Photo';
    document.getElementById('photoId').value = '';
    document.getElementById('photoForm').reset();
    document.getElementById('imageUrl').value = '';
    imagePreview.src = '';
    imagePreview.style.display = 'none';
    noticeArea.style.display = 'none';
    updateButtons();
    modal.style.display = 'flex';
}

// Open modal for editing
function openModalForEdit(photo) {
    document.getElementById('modalTitle').innerHTML = '<i class="fas fa-edit"></i> Edit Photo';
    document.getElementById('photoId').value = photo.id || '';
    document.getElementById('title').value = photo.title || '';
    document.getElementById('description').value = photo.description || '';
    document.getElementById('dateTaken').value = photo.dateTaken ? photo.dateTaken.substring(0, 10) : '';
    document.getElementById('imageUrl').value = photo.imageUrl || '';
    
    if (photo.imageUrl) {
        imagePreview.src = photo.imageUrl;
        imagePreview.style.display = 'block';
    } else {
        imagePreview.style.display = 'none';
    }
    
    noticeArea.style.display = 'none';
    updateButtons();
    modal.style.display = 'flex';
}

// Close modal
function closeModalFunc() {
    modal.style.display = 'none';
}

// Event listeners
browseButton.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) uploadFile(file);
});

uploadArea.addEventListener('click', () => {
    fileInput.click();
});

removeImageButton.addEventListener('click', removeImage);

// Drag and drop
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = '#3498db';
});

uploadArea.addEventListener('dragleave', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = '#ddd';
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = '#ddd';
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
});

// Modal close
closeModal.addEventListener('click', closeModalFunc);
cancelButton.addEventListener('click', closeModalFunc);
modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModalFunc();
});

// Export functions
window.upload = {
    openModalForNew,
    openModalForEdit,
    closeModalFunc
};