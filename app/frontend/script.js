// frontend/script.js
fetch('http://localhost:3001/api/files')
  .then(res => res.json())
  .then(files => {
    const list = document.getElementById('fileList');
    files.forEach(file => {
      const li = document.createElement('li');
      const link = document.createElement('a');
      link.href = `http://localhost:3001/api/download?file=${encodeURIComponent(file)}`;
      link.textContent = file;
      li.appendChild(link);
      list.appendChild(li);
    });
  });