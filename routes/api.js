// routes/api.js
import express from 'express'
const router = express.Router()

// 使用 photos 模型而不是 cats
const model = 'photo'  // 改為單數形式

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

import { del } from '@vercel/blob'

// 連接數據庫
prisma.$connect().then(() => {
    console.log('Prisma connected to MongoDB')
}).catch(err => {
    console.error('Failed to connect to MongoDB:', err)
})

// ----- CREATE (POST) -----
router.post('/data', async (req, res) => {
    try {
        const { id, ...createData } = req.body

        const created = await prisma[model].create({
            data: createData
        })
        res.status(201).send(created)
    } catch (err) {
        console.error('POST /data error:', err)
        res.status(500).send({ error: 'Failed to create record', details: err.message || err })
    }
})

// ----- READ (GET) list ----- 
router.get('/data', async (req, res) => {
    try {
        const result = await prisma[model].findMany({
            take: 100,
            orderBy: { createdAt: 'desc' }
        })
        res.send(result)
    } catch (err) {
        console.error('GET /data error:', err)
        res.status(500).send({ error: 'Failed to fetch records', details: err.message || err })
    }
})

// ----- UPDATE (PUT) -----
router.put('/data/:id', async (req, res) => {
    const { id, _id, ...requestBody } = req.body || {};

    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const updated = await prisma[model].update({
                where: { id: req.params.id },
                data: requestBody,
            });
            console.log(`PUT /data/${req.params.id} successful on attempt ${attempt}:`, updated);

            return res.send(updated);
        } catch (err) {
            if (err.code === 'P2034') {
                if (attempt < 2) {
                    await new Promise(r => setTimeout(r, 100))
                    continue;
                }
                return res.status(409).send({ error: 'Write conflict, please retry' });
            }

            console.error('PUT /data/:id error:', err);
            return res.status(500).send({ error: 'Failed to update record' });
        }
    }
});

// ----- DELETE -----
router.delete('/data/:id', async (req, res) => {
    try {
        // Get the photo record first to get the image URL
        const photo = await prisma[model].findUnique({
            where: { id: req.params.id }
        })

        // Delete from database
        const result = await prisma[model].delete({
            where: { id: req.params.id }
        })

        // Delete associated image from Vercel Blob (if exists)
        if (photo?.imageUrl) {
            try {
                await del(photo.imageUrl)
                console.log('Deleted image:', photo.imageUrl)
            } catch (blobError) {
                console.error('Failed to delete image:', blobError)
                // Don't fail the whole operation if image delete fails
            }
        }

        res.send(result)
    } catch (err) {
        console.error('DELETE /data/:id error:', err)
        res.status(500).send({ error: 'Failed to delete record', details: err.message || err })
    }
})

export default router;