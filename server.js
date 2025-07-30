const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3000;
const FILES_DIR = path.join(__dirname, 'files');

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = decodeURIComponent(parsedUrl.pathname);

    if (pathname === '/') {
        fs.readdir(FILES_DIR, (err, files) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                return res.end('파일 목록을 불러올 수 없습니다.');
            }

            const listHtml = files.map(file => {
                return `<li><a href="/download/${encodeURIComponent(file)}">${file}</a></li>`;
            }).join('');

            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`<h1>파일 목록</h1><a href="/csv">CSV 보기</a><br><ul>${listHtml}</ul><br>`);
        });

    } else if (pathname.startsWith('/download/')) {
        const filename = pathname.replace('/download/', '');
        const filepath = path.join(FILES_DIR, filename);

        if (!filepath.startsWith(FILES_DIR)) {
            res.writeHead(400);
            return res.end('잘못된 요청입니다.');
        }

        fs.stat(filepath, (err, stat) => {
            if (err || !stat.isFile()) {
                res.writeHead(404);
                return res.end('파일이 존재하지 않습니다.');
            }

            res.writeHead(200, {
                'Content-Disposition': `attachment; filename="${path.basename(filepath)}"`,
                'Content-Type': 'application/octet-stream'
            });

            const readStream = fs.createReadStream(filepath);
            readStream.pipe(res);
        });

    } else if (pathname === '/csv') {
        // 📌 CSV 보기 기능 추가
        const csvFilePath = path.join(FILES_DIR, 'sample.csv');
        fs.readFile(csvFilePath, 'utf8', (err, data) => {
            if (err) {
                res.writeHead(500);
                return res.end('CSV 파일을 불러올 수 없습니다.');
            }

            const lines = data.trim().split('\n');
            const rows = lines.map(line => line.split(','));

            const tableHtml = rows.map((cols, i) => {
                const tag = i === 0 ? 'th' : 'td';
                return `<tr>${cols.map(col => `<${tag}>${col}</${tag}>`).join('')}</tr>`;
            }).join('\n');

            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`
                <h1>CSV 파일 내용 보기</h1>
                <a href="/">← 파일 목록으로</a><br>
                <table border="1" cellpadding="5">${tableHtml}</table>
                <br>
            `);
        });

    } else {
        res.writeHead(404);
        res.end('페이지를 찾을 수 없습니다.');
    }
});

server.listen(PORT, () => {
    console.log(`서버 실행 중: http://localhost:${PORT}`);
});
