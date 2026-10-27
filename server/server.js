var formidable = require('formidable');
var express = require('express');
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var rateLimit = require('express-rate-limit').rateLimit;
var app = express();
var uploadDir = path.join(__dirname, "uploaded");
var uploadRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 60,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: "Too many uploads. Please try again later."
});
app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "PUT, POST, GET, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "*");
    res.header("Access-Control-Allow-Credentials", true);
    next();
});

app.post('/upload', uploadRateLimit, async function (req, res) {
    try {
        await fs.promises.mkdir(uploadDir, { recursive: true });
    } catch (err) {
        console.error('file upload directory creation failed', err);
        res.status(500).send("File upload failed.");
        return;
    }

    var parsed;
    try {
        var form = new formidable.IncomingForm({
            maxFiles: 1,
            uploadDir: uploadDir,
            filename: function (name, ext, part) {
                var extension = path.extname(part.originalFilename || "").toLowerCase();
                if (!/^\.(bmp|jpe?g|png|tiff?|pdf)$/.test(extension)) {
                    extension = "";
                }
                return crypto.randomUUID() + extension;
            }
        });
        parsed = await new Promise(function (resolve, reject) {
            form.parse(req, function (err, fields, files) {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(files);
            });
        });
    } catch (err) {
        console.error('file upload parsing failed', err);
        res.status(400).send("File upload failed.");
        return;
    }

    var uploadedFiles = parsed.RemoteFile;
    var uploadedFile = Array.isArray(uploadedFiles) ? uploadedFiles[0] : uploadedFiles;
    if (!uploadedFile) {
        res.status(400).send("No file was uploaded.");
        return;
    }

    console.log('file saved');
    res.status(201).end();
});

var server = app.listen(2020, function () {
    var host = server.address().address;
    var port = server.address().port;
    console.log('listening at http://%s:%s', host, port);
})