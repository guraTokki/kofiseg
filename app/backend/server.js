// backend/server.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const querystring = require('querystring');

const PORT = 3001;
const FILES_DIR = path.join(__dirname, 'files');

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url);
    const pathname = decodeURIComponent(parsedUrl.pathname);

    // CORS 헤더 추가 (정적 페이지에서 접근 허용)
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (pathname === '/api/files') {
        fs.readdir(FILES_DIR, (err, files) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: '파일 목록 오류' }));
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(files));
        });

    } else if (pathname === '/api/download') {
        const query = querystring.parse(parsedUrl.query);
        const filename = query.file;
        const filepath = path.join(FILES_DIR, filename);

        if (!filepath.startsWith(FILES_DIR)) {
            res.writeHead(400);
            return res.end('잘못된 접근입니다.');
        }

        fs.stat(filepath, (err, stat) => {
            if (err || !stat.isFile()) {
                res.writeHead(404);
                return res.end('파일 없음');
            }

            res.writeHead(200, {
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Content-Type': 'application/octet-stream'
            });

            fs.createReadStream(filepath).pipe(res);
        });

    } else if (pathname === '/api/csv') {
        const csvPath = path.join(FILES_DIR, 'sample.csv');

        fs.readFile(csvPath, 'utf8', (err, data) => {
            if (err) {
                res.writeHead(500);
                return res.end('CSV 파일 읽기 실패');
            }

            const lines = data.trim().split('\n');
            const rows = lines.map(line => line.split(','));
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(rows));
        });

    } else {
        res.writeHead(404);
        res.end('Not found');
    }
});

server.listen(PORT, () => {
    console.log(`API 서버 실행 중: http://localhost:${PORT}`);
});