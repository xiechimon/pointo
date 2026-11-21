const button = document.getElementById('save-btn');
const toast = document.getElementById('toast');

if (button) {
  button.addEventListener('click', () => {
    toast.hidden = false;
    setTimeout(() => (toast.hidden = true), 2000);
  });
}
