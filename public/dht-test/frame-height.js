/* Explicit parent opt-in. Messages contain only an integer CSS height. */
let hostOrigin, lastHeight = 0, scheduled = false;
const app = document.querySelector('.app');
function measure() {
 scheduled = false;
 if (!hostOrigin) return;
 const height = Math.ceil(app.getBoundingClientRect().height);
 if (height > 0 && height <= 100000 && height !== lastHeight) {
  lastHeight = height;
  parent.postMessage(height, hostOrigin);
 }
}
function schedule() {
 if (!scheduled) { scheduled = true; requestAnimationFrame(measure); }
}
window.addEventListener('message', event => {
 if (event.source !== parent || parent === window || event.origin === 'null' || event.data !== 'dht-height-request') return;
 if (hostOrigin && hostOrigin !== event.origin) return;
 hostOrigin = event.origin;
 app.classList.add('height-embedded');
 lastHeight = 0;
 schedule();
});
new ResizeObserver(schedule).observe(app);
window.addEventListener('load', schedule);
// Tell the host that the request listener is installed, without sending content.
// A number is also the complete height-response protocol.
if (parent !== window) {
 // Initial request may arrive before this deferred module: host retries on load.
 window.addEventListener('pageshow', schedule);
}
