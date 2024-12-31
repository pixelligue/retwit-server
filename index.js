require('dotenv').config()

const express = require('express')
const cors = require('cors')
const multer = require('multer')
const AWS = require('aws-sdk')
const { v4: uuidv4 } = require('uuid')
const path = require('path')

const app = express()
const upload = multer()

// Добавляем логирование запросов
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`)
  next()
})

app.use(cors({
  origin: ['http://localhost:5173', 'https://retwit-e2ab6.web.app'],
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}))

app.use(express.json())

// Конфигурация S3
const endpoint = new AWS.Endpoint('https://s3.timeweb.cloud')
const s3 = new AWS.S3({
  endpoint: endpoint,
  accessKeyId: process.env.S3_ACCESS_KEY,
  secretAccessKey: process.env.S3_SECRET_KEY,
  region: 'ru-1',
  s3ForcePathStyle: true,
  signatureVersion: 'v4',
  correctClockSkew: true
})

const BUCKET_NAME = process.env.S3_BUCKET_NAME

console.log('Текущая конфигурация S3:', {
  accessKeyId: process.env.S3_ACCESS_KEY?.substring(0, 5) + '...',
  bucketName: BUCKET_NAME,
  endpoint: endpoint.href
})

// Обработчик загрузки файлов
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    console.log('Получен запрос на загрузку:', {
      file: req.file ? {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      } : null,
      body: req.body
    })

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Файл не найден' })
    }

    const file = req.file
    const folder = req.body.folder || ''
    const filename = req.body.filename || `${uuidv4()}${path.extname(file.originalname)}`
    const key = folder ? `${folder}/${filename}` : filename

    const params = {
      Bucket: BUCKET_NAME,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      ACL: 'public-read'
    }

    console.log('Начало загрузки в S3:', {
      bucket: BUCKET_NAME,
      key: key,
      contentType: file.mimetype,
      size: file.size
    })

    try {
      const uploadResult = await s3.putObject(params).promise()
      console.log('Файл успешно загружен:', uploadResult)

      const url = `https://${BUCKET_NAME}.s3.timeweb.cloud/${key}`
      console.log('Сформированный URL:', url)

      res.json({
        success: true,
        url: url,
        key: key
      })
    } catch (uploadError) {
      console.error('Ошибка при загрузке в S3:', {
        error: uploadError.message,
        code: uploadError.code,
        statusCode: uploadError.statusCode,
        requestId: uploadError.requestId
      })
      throw uploadError
    }
  } catch (error) {
    console.error('Ошибка при обработке запроса:', {
      error: error.message,
      code: error.code,
      stack: error.stack
    })
    res.status(500).json({
      success: false,
      message: 'Ошибка при загрузке файла',
      error: error.message,
      code: error.code
    })
  }
})

const PORT = process.env.PORT || 10000
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Сервер запущен на порту ${PORT}`)
  console.log('Текущая конфигурация:', {
    port: PORT,
    bucketName: BUCKET_NAME
  })
}) 