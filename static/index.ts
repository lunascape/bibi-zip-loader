import * as mime from 'mime';

const url = 'lenna.epub';

const loader = new LSZL({
  url,
  forceInMemoryCache: false,
  forceKeepCache: false,
});

loader.getEntryNames().then((entries) => {
  const select = document.getElementById('entries') as HTMLSelectElement;
  select.size = entries.length;
  select.onchange = (ev) => loadEntry(ev.target['value']);
  entries.sort().map((e) => {
    const option = document.createElement('option');
    option.value = e;
    option.textContent = e;
    return option;
  }).forEach(select.appendChild.bind(select));
  const container = document.getElementById('container') as HTMLDivElement;
  container.style.visibility = 'visible';
});

let promise = Promise.resolve();
function loadEntry(entryName: string) {
  promise = promise.catch(() => { }).then(async () => {
    const content = document.getElementById('content') as HTMLDivElement;
    content.childNodes.forEach(content.removeChild.bind(content));
    const buff = await loader.getBuffer(entryName);
    const type = mime.getType(entryName);
    const isImage = /^image\//.test(type);
    const blob = new Blob([buff], { type });

    if (isImage) {
      const url = URL.createObjectURL(blob);
      const img = document.createElement('img');
      img.src = url;
      img.className = 'image';
      content.appendChild(img);
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1);
      return;
    }

    await new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const text = reader.result as string;
          const div = document.createElement('div');
          div.className = 'text';
          const pre = document.createElement('pre');
          pre.textContent = text;
          div.appendChild(pre);
          content.appendChild(div);
          res();
        } catch (err) {
          rej(err);
        }
      };
      reader.onerror = rej;
      reader.readAsText(blob);
    });
  });

};