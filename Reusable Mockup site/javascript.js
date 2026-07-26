const navToggle = document.getElementById('navToggle');
const navMenu = document.querySelector('#mainNav ul');


navToggle.addEventListener('click', () => {
    navMenu.classList.toggle('open');
});