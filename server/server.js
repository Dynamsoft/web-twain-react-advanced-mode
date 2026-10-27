var formidable = require('formidable');
var express = require('express');
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var app = express();
var uploadDir = path.join(__dirname, "uploaded");
app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "PUT, POST, GET, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "*");
    res.header("Access-Control-Allow-Credentials", true);
    next();
});

app.post('/upload', async function (req, res) {
    var parsed;
    try {
        var form = new formidable.IncomingForm({ maxFiles: 1 });
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
    if (!uploadedFile || !uploadedFile.filepath) {
        res.status(400).send("No file was uploaded.");
        return;
    }

    var extension = path.extname(uploadedFile.originalFilename || "").toLowerCase();
    if (!/^\.(bmp|jpe?g|png|tiff?|pdf)$/.test(extension)) {
        extension = "";
    }
    var destination = path.join(uploadDir, crypto.randomUUID() + extension);
    try {
        await fs.promises.mkdir(uploadDir, { recursive: true });
        await fs.promises.copyFile(uploadedFile.filepath, destination, fs.constants.COPYFILE_EXCL);
        console.log('file saved');
        res.status(201).end();
    } catch (err) {
        console.error('file upload storage failed', err);
        res.status(500).send("File upload failed.");
    }
});

var server = app.listen(2020, function () {
    var host = server.address().address;
    var port = server.address().port;
    console.log('listening at http://%s:%s', host, port);
})