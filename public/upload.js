// Upload module for handling image uploads to Vercel Blob

const imagePreview = document.querySelector('#imagePreview')
const fileInput = document.querySelector('#fileInput')
const uploadArea = document.querySelector('#uploadArea')
const noticeArea = document.querySelector('#noticeArea')
const myForm = document.querySelector('#myForm')

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

// Upload a file to the server
const upload = async (theFile) => {
    // Validate file size
    if (theFile.size > MAX_FILE_SIZE) {
        alert('Maximum file size is 10MB')
        return
    }

    // Validate file type
    if (!theFile.type.startsWith('image/')) {
        noticeArea.style.display = 'block'
        noticeArea.textContent = 'Only image files are supported.'
        return
    }

    // Show loading state
    imagePreview.setAttribute('src', 'assets/load.svg')
    noticeArea.style.display = 'none'

    // Prepare upload
    const formData = new FormData()
    formData.append('image', theFile)

    try {
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        })

        if (!response.ok) {
            const errorData = await response.json()
            noticeArea.style.display = 'block'
            noticeArea.textContent = errorData.error || 'Upload failed'
            imagePreview.setAttribute('src', 'assets/photo.svg')
            return
        }

        const uploadDetails = await response.json()
        console.log('Upload successful:', uploadDetails)

        // Update preview with Vercel Blob URL
        imagePreview.setAttribute('src', uploadDetails.url)

        // Store URL in hidden form field
        myForm.elements['imageUrl'].value = uploadDetails.url
        myForm.elements['imagePath'].value = uploadDetails.pathname || ''

    } catch (err) {
        console.error('Upload error:', err)
        noticeArea.style.display = 'block'
        noticeArea.textContent = 'An error occurred during upload'
        imagePreview.setAttribute('src', 'assets/photo.svg')
    }
}

// BROWSE BUTTON
fileInput.addEventListener('change', (event) => {
    const file = event.currentTarget.files[0]
    if (file) upload(file)
})

// DRAG AND DROP (for devices with fine pointer control)
if (window.matchMedia('(pointer: fine)').matches) {
    const dragAndDropEvents = {
        dragenter: () => uploadArea.classList.add('ready'),
        dragover: () => uploadArea.classList.add('ready'),
        dragleave: (event) => {
            if (!uploadArea.contains(event.relatedTarget)) {
                uploadArea.classList.remove('ready')
            }
        },
        drop: (event) => {
            uploadArea.classList.remove('ready')
            const file = event.dataTransfer.files[0]
            if (file) upload(file)
        }
    }

    for (const [eventName, handler] of Object.entries(dragAndDropEvents)) {
        uploadArea.addEventListener(eventName, (e) => {
            e.preventDefault()
            e.stopPropagation()
        })
        uploadArea.addEventListener(eventName, handler)
    }
}
