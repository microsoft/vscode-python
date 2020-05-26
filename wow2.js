const src = Array.from(document.querySelectorAll('script')).filter((item) =>
    ((item.attributes['src'] || '').value || '').endsWith('wow.js')
)[0].attributes['src'].value;
console.error('src');
console.error(src);
const paths = src.split('/');
paths.pop();
console.error(paths);
window.__PVSC_Public_Path = paths.join('/') + '/out/datascience-ui/notebook/';
console.error('window.__PVSC_Public_Path');
// tslint:disable-next-line: no-any
console.error(window.__PVSC_Public_Path);
