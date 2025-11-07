# Plan: Vercel Blob Image Upload System

## Overview
Implement image upload functionality using **Vercel Blob** storage. This approach separates concerns: MongoDB (via Prisma) handles structured data (cat records), while Vercel Blob handles binary file storage. This is ideal for deployment on Vercel and eliminates confusion about Prisma's role.

## Why Vercel Blob?

### Advantages over GridFS
- **Separation of concerns**: MongoDB stores data, Blob stores files (not mixing purposes)
- **Serverless-friendly**: Perfect for Vercel deployment (no filesystem needed)
- **Simple API**: Easy-to-use `put()` and `del()` methods
- **Built-in CDN**: Automatic global distribution for fast image delivery
- **No database overhead**: Files don't consume MongoDB storage/bandwidth
- **Public URLs**: Direct image URLs (no custom retrieval endpoint needed)
- **Automatic caching**: Built-in cache headers for optimal performance

### Architecture
```
User Upload → Sharp Processing → Vercel Blob Storage → Public URL → MongoDB Reference
```

## Technical Implementation

### 1. Backend Setup

#### A. Install Dependencies
```bash
npm install @vercel/blob sharp busboy
```

#### B. Environment Variables
**File**: `.env`

```env
# MongoDB connection
DATABASE_URL="mongodb+srv://..."

# Vercel Blob token
BLOB_READ_WRITE_TOKEN="vercel_blob_rw_..."
```

**Note**: On Vercel deployment, `BLOB_READ_WRITE_TOKEN` is auto-injected. For local development, get it from Vercel dashboard.

#### C. Upload Endpoint
**File**: `routes/upload.js` (new file)

```javascript
import express from 'express'
import busboy from 'busboy'
import sharp from 'sharp'
import { put } from '@vercel/blob'

const router = express.Router()

// Configuration
const MAX_FILE_SIZE = 10 * 1024 * 1024  // 10MB
const MAX_WIDTH = 800
const MAX_HEIGHT = 800
const JPEG_QUALITY = 85
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']

router.post('/upload', async (req, res) => {
  const bb = busboy({ headers: req.headers })
  
  bb.on('file', async (name, file, info) => {
    try {
      // Validate file type
      if (!ALLOWED_TYPES.includes(info.mimeType)) {
        return res.status(400).json({ 
          error: 'Invalid file type. Only images allowed.' 
        })
      }

      // Collect file data into buffer
      const chunks = []
      let fileSize = 0
      
      file.on('data', (chunk) => {
        fileSize += chunk.length
        if (fileSize > MAX_FILE_SIZE) {
          file.destroy()
          return res.status(400).json({ 
            error: 'File too large. Maximum size is 10MB.' 
          })
        }
        chunks.push(chunk)
      })

      file.on('end', async () => {
        const buffer = Buffer.concat(chunks)
        
        // Process image with Sharp (skip SVGs)
        let processedBuffer = buffer
        let contentType = info.mimeType
        
        if (!info.mimeType.includes('svg')) {
          processedBuffer = await sharp(buffer)
            .resize(MAX_WIDTH, MAX_HEIGHT, {
              fit: 'inside',
              withoutEnlargement: true
            })
            .jpeg({ quality: JPEG_QUALITY })
            .toBuffer()
          
          contentType = 'image/jpeg'
        }

        // Upload to Vercel Blob
        const blob = await put(
          `cat-images/${Date.now()}-${info.filename}`,
          processedBuffer,
          {
            access: 'public',
            contentType: contentType,
            addRandomSuffix: true,
            cacheControlMaxAge: 31536000  // 1 year
          }
        )

        // Return blob details
        res.json({
          url: blob.url,
          pathname: blob.pathname,
          contentType: blob.contentType,
          size: processedBuffer.length
        })
      })

    } catch (error) {
      console.error('Upload error:', error)
      res.status(500).json({ 
        error: 'Upload failed', 
        details: error.message 
      })
    }
  })

  req.pipe(bb)
})

export default router
```

#### D. Delete Endpoint (Optional Cleanup)
**File**: `routes/upload.js` (add to same file)

```javascript
import { del } from '@vercel/blob'

router.delete('/image/:url', async (req, res) => {
  try {
    const url = decodeURIComponent(req.params.url)
    await del(url)
    res.json({ deleted: url })
  } catch (error) {
    console.error('Delete error:', error)
    res.status(500).json({ 
      error: 'Delete failed', 
      details: error.message 
    })
  }
})
```

#### E. Update Server Entry Point
**File**: `server.js`

```javascript
// Add after existing imports
import uploadRoutes from './routes/upload.js'
app.use('/api', uploadRoutes)
```

### 2. Database Schema Updates

#### Update Prisma Schema
**File**: `prisma/schema.prisma`

```prisma
model cats {
  id             String    @id @default(auto()) @map("_id") @db.ObjectId
  // ... existing fields ...
  
  // New field for Vercel Blob image URL
  imageUrl       String?
  
  // Optional: Store pathname for easier deletion
  imagePath      String?
}
```

**Commands to run**:
```bash
npx prisma generate
npx prisma db push
```

#### Update API Routes
**File**: `routes/api.js`

The existing CRUD operations will automatically handle the new `imageUrl` field. No changes needed unless you want to add image deletion on cat deletion.

**Optional: Delete image when cat is deleted**:
```javascript
import { del } from '@vercel/blob'

router.delete('/data/:id', async (req, res) => {
  try {
    // Get the cat record first to get the image URL
    const cat = await prisma[model].findUnique({
      where: { id: req.params.id }
    })
    
    // Delete from database
    const result = await prisma[model].delete({
      where: { id: req.params.id }
    })
    
    // Delete associated image from Vercel Blob
    if (cat?.imageUrl) {
      await del(cat.imageUrl).catch(err => {
        console.error('Failed to delete image:', err)
        // Don't fail the whole operation if image delete fails
      })
    }
    
    res.send(result)
  } catch (err) {
    console.error('DELETE /data/:id error:', err)
    res.status(500).send({ 
      error: 'Failed to delete record', 
      details: err.message || err 
    })
  }
})
```

### 3. Frontend Implementation

#### A. Create Upload Module
**File**: `public/upload.js` (new file)

```javascript
// Upload module for handling image uploads to Vercel Blob

const imagePreview = document.querySelector('#imagePreview')
const fileInput = document.querySelector('#fileInput')
const uploadArea = document.querySelector('#uploadArea')
const noticeArea = document.querySelector('#noticeArea')
const itemForm = document.querySelector('#myForm')

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
    itemForm.elements['imageUrl'].value = uploadDetails.url
    itemForm.elements['imagePath'].value = uploadDetails.pathname || ''

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
```

#### B. Update HTML Form
**File**: `public/index.html`

Add to the form:
```html
<form id="myForm">
  <!-- Existing fields... -->
  
  <!-- Image upload section -->
  <div id="uploadArea">
    <img id="imagePreview" src="assets/photo.svg" alt="Image preview" />
    <input type="file" id="fileInput" accept="image/*" style="display:none" />
    <button type="button" onclick="fileInput.click()">Browse</button>
    <p>or drag and drop an image here</p>
  </div>
  
  <!-- Hidden fields to store image data -->
  <input type="hidden" name="imageUrl" />
  <input type="hidden" name="imagePath" />
  
  <div id="noticeArea" style="display:none"></div>
  
  <!-- Existing submit button... -->
</form>

<!-- Load upload module -->
<script src="upload.js"></script>
```

#### C. Update Display Logic
**File**: `public/script.js`

Update `renderItem()` function:
```javascript
const renderItem = (item) => {
  const div = document.createElement('div')
  div.classList.add('item-card')
  div.setAttribute('data-id', item.id)

  // Add image display if available
  const imageHTML = item.imageUrl 
    ? `<img src="${item.imageUrl}" alt="${item.name}" class="cat-image" />`
    : ''

  const template = /*html*/`
    ${imageHTML}
    <div class="item-heading">
      <h3>${item.name}</h3>
      <div class="microchip-info">
        <img src="./assets/chip.svg" /> ${item.microchip || '<i>???</i>'} 
      </div>  
    </div>
    <!-- Rest of existing template... -->
  `
  
  div.innerHTML = DOMPurify.sanitize(template)
  
  // Existing event listeners...
  
  return div
}
```

Update `editItem()` to handle images:
```javascript
const editItem = (data) => {
  console.log('Editing:', data)

  // Populate form fields
  Object.keys(data).forEach(field => {
    const element = myForm.elements[field]
    if (element) {
      if (element.type === 'checkbox') {
        element.checked = data[field]
      } else if (element.type === 'date') {
        element.value = data[field] ? data[field].substring(0, 10) : ''
      } else {
        element.value = data[field]
      }
    }
  })

  // Update image preview if image exists
  if (data.imageUrl) {
    imagePreview.setAttribute('src', data.imageUrl)
  } else {
    imagePreview.setAttribute('src', 'assets/photo.svg')
  }

  formHeading.textContent = '🐈 Edit Cat'
  formPopover.showPopover()
}
```

#### D. Add CSS Styling
**File**: `public/style.css`

```css
/* Upload Area */
#uploadArea {
  border: 2px dashed #ccc;
  border-radius: 8px;
  padding: 20px;
  text-align: center;
  transition: all 0.3s ease;
  cursor: pointer;
  margin: 20px 0;
}

#uploadArea.ready {
  border-color: #4CAF50;
  background-color: #f1f8f4;
}

#imagePreview {
  max-width: 200px;
  max-height: 200px;
  object-fit: contain;
  margin: 10px auto;
  display: block;
}

#noticeArea {
  background-color: #ffebee;
  color: #c62828;
  padding: 10px;
  border-radius: 4px;
  margin: 10px 0;
  font-size: 0.9em;
}

/* Cat Image in Card */
.cat-image {
  width: 100%;
  height: 200px;
  object-fit: cover;
  border-radius: 8px 8px 0 0;
  margin-bottom: 10px;
}

.item-card {
  border-radius: 8px;
  overflow: hidden;
}
```

## Implementation Checklist

### Phase 1: Backend Setup ✓
- [ ] Install dependencies: `@vercel/blob`, `sharp`, `busboy`
- [ ] Create `.env` file with `BLOB_READ_WRITE_TOKEN`
- [ ] Create `routes/upload.js` with upload endpoint
- [ ] Add delete endpoint for cleanup
- [ ] Update `server.js` to mount upload routes
- [ ] Test upload with Postman/curl

### Phase 2: Database Integration ✓
- [ ] Update Prisma schema with `imageUrl` and `imagePath` fields
- [ ] Run `npx prisma generate`
- [ ] Run `npx prisma db push` (or create migration)
- [ ] Optional: Update delete endpoint in `api.js` to clean up blobs
- [ ] Test CRUD operations with image fields

### Phase 3: Frontend Integration ✓
- [ ] Create `public/upload.js` module
- [ ] Update `index.html` with upload form controls
- [ ] Add hidden inputs for `imageUrl` and `imagePath`
- [ ] Update `script.js` to display images in cards
- [ ] Update `editItem()` to handle image preview
- [ ] Add CSS styling for upload UI and image display

### Phase 4: Testing ✓
- [ ] Upload JPEG image
- [ ] Upload PNG image
- [ ] Upload WebP image
- [ ] Upload SVG image
- [ ] Test file size limit (>10MB should reject)
- [ ] Test non-image file (should reject)
- [ ] Test drag and drop
- [ ] Test browse button
- [ ] Create cat with image
- [ ] Edit cat and change image
- [ ] Delete cat (verify image cleanup if implemented)
- [ ] Test on mobile device

## Vercel Dashboard Setup (No CLI Required)

### Step 1: Create/Import Project
1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click **"Add New..." → "Project"**
3. Import your GitHub repository (or upload files)
4. Configure build settings:
   - **Framework Preset**: Other
   - **Build Command**: `npm install` (or leave blank)
   - **Output Directory**: Leave blank
   - **Install Command**: `npm install`
5. Click **"Deploy"** to create the project

### Step 2: Create Blob Storage
1. In your project dashboard, click the **"Storage"** tab
2. Click **"Create Database"** or **"Connect Store"**
3. Select **"Blob"** from the storage options
4. Give it a name (e.g., "cat-images-blob")
5. Click **"Create"**
6. Vercel will automatically:
   - Create the Blob store
   - Add `BLOB_READ_WRITE_TOKEN` to your environment variables
   - Link it to your project

### Step 3: Add MongoDB Environment Variable
1. Go to **Settings** → **Environment Variables**
2. Add a new variable:
   - **Name**: `DATABASE_URL`
   - **Value**: Your MongoDB connection string (e.g., `mongodb+srv://user:pass@cluster.mongodb.net/dbname`)
   - **Environment**: Check all (Production, Preview, Development)
3. Click **"Save"**

### Step 4: Redeploy
1. Go to **Deployments** tab
2. Click the **"..."** menu on the latest deployment
3. Click **"Redeploy"**
   - Or push a new commit to trigger automatic deployment

Your app will now have access to both `BLOB_READ_WRITE_TOKEN` (automatic) and `DATABASE_URL` (manual).

## Local Development Setup

### Option 1: Get Token from Dashboard
1. Go to your project → **Storage** tab
2. Click on your Blob store
3. Click **"..." → "Copy Read Write Token"** or look under the **".env.local"** tab
4. Create `.env` file in your project root:
   ```env
   DATABASE_URL="mongodb+srv://..."
   BLOB_READ_WRITE_TOKEN="vercel_blob_rw_xxxxx"
   ```

### Option 2: Pull Environment Variables (with Vercel CLI)
If you do have the CLI installed, you can pull env vars:
```bash
vercel env pull .env
```
This downloads all environment variables from Vercel to your local `.env` file.

### Start Dev Server
```bash
npm run dev
```

## Vercel Deployment Workflow

### Initial Setup (One-time)
1. ✅ Import repository to Vercel
2. ✅ Create Blob store
3. ✅ Add `DATABASE_URL` environment variable
4. ✅ Deploy project

### Development Workflow
1. Make changes locally
2. Test with `.env` file (with tokens from dashboard)
3. Push to GitHub
4. Vercel automatically deploys
5. Environment variables are automatically available in production

## Configuration Constants

```javascript
// Image upload limits
const MAX_FILE_SIZE = 10 * 1024 * 1024      // 10MB
const MAX_WIDTH = 800                        // pixels
const MAX_HEIGHT = 800                       // pixels
const JPEG_QUALITY = 85                      // 0-100
const CACHE_MAX_AGE = 31536000              // 1 year in seconds

// Allowed MIME types
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png', 
  'image/webp',
  'image/svg+xml'
]
```

## API Endpoints Summary

| Method | Endpoint | Purpose | Response |
|--------|----------|---------|----------|
| POST | `/api/upload` | Upload image to Vercel Blob | `{ url, pathname, contentType, size }` |
| DELETE | `/api/image/:url` | Delete image from Vercel Blob | `{ deleted: url }` |
| POST | `/data` | Create cat record (with imageUrl) | Cat object |
| PUT | `/data/:id` | Update cat record | Updated cat |
| DELETE | `/data/:id` | Delete cat + image | Deleted cat |

## Data Flow

### Upload Flow
```
1. User selects image
2. Frontend validates (type, size)
3. POST to /api/upload with FormData
4. Server validates and buffers file
5. Sharp processes image (resize, compress)
6. put() uploads to Vercel Blob
7. Returns public URL
8. Frontend stores URL in form field
9. User submits form with imageUrl
10. API saves cat record with imageUrl to MongoDB
```

### Display Flow
```
1. Frontend fetches cat records from /data
2. Each cat has imageUrl field
3. Render <img src={imageUrl} />
4. Browser loads image directly from Vercel CDN
5. Cached globally for fast delivery
```

### Delete Flow
```
1. User clicks delete button
2. DELETE /data/:id
3. Server fetches cat record (get imageUrl)
4. Deletes cat from MongoDB
5. Calls del(imageUrl) to remove from Blob
6. Returns success
```

## Security Considerations

1. **File Type Validation**: Check MIME type on backend (not just extension)
2. **File Size Limits**: Enforce 10MB max to prevent abuse
3. **Content Processing**: All uploads processed through Sharp (sanitizes images)
4. **Access Control**: Consider adding authentication to `/api/upload`
5. **Rate Limiting**: Add rate limits to prevent spam uploads
6. **URL Encoding**: Properly encode/decode URLs for delete operations

## Cost Considerations

**Vercel Blob Pricing** (as of 2024):
- **Free tier**: 500MB storage, 5GB bandwidth/month
- **Pro tier**: $0.08/GB storage, $0.15/GB bandwidth
- Small profile images (<100KB each) = very affordable
- Example: 100 cats × 80KB images = 8MB storage

## Future Enhancements

1. **Image Optimization**
   - Generate thumbnails (200x200) for list view
   - Generate multiple sizes for responsive images
   - WebP conversion for better compression

2. **Advanced Features**
   - Multiple images per cat (gallery)
   - Image cropping tool before upload
   - Background removal (AI-powered)
   - Automatic alt text generation

3. **Performance**
   - Lazy loading images
   - Blur-up placeholder technique
   - Progressive image loading

4. **Management**
   - Bulk delete orphaned images
   - Storage usage dashboard
   - Image analytics (views, downloads)

## Advantages Over Filesystem Approach

| Aspect | Filesystem | Vercel Blob |
|--------|------------|-------------|
| **Deployment** | Requires persistent storage | Works on serverless |
| **Scalability** | Limited by disk space | Unlimited (pay as you go) |
| **CDN** | Manual setup required | Built-in, automatic |
| **Backups** | Manual process | Automatic, redundant |
| **URLs** | Relative paths | Absolute, global URLs |
| **Cleanup** | Manual file deletion | Simple del() API |
| **Caching** | Manual headers | Automatic optimization |

## Notes

- Vercel Blob is optimized for files up to 500MB (perfect for images)
- `addRandomSuffix: true` prevents filename collisions
- Public URLs are served via CDN for fast global access
- `cacheControlMaxAge` sets browser/CDN caching (1 year is standard for immutable images)
- Sharp automatically strips metadata for privacy and smaller file size
- SVG files bypass Sharp processing (already optimized)
- Consider adding image alt text field for accessibility
