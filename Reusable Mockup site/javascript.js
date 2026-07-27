// Grabs the hamburger button and the <ul> inside #mainNav.
// Clicking the button toggles the .open class, which style.css
// uses to show/hide the mobile nav menu (see @media block)

const navToggle = document.getElementById('navToggle');
const navMenu = document.querySelector('#mainNav ul');


navToggle.addEventListener('click', () => {
    navMenu.classList.toggle('open');
});