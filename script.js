// --- LAYOUT INTERACTION MANAGEMENT ---
const container = document.getElementById('container');
const registerBtn = document.getElementById('register');
const loginBtn = document.getElementById('login-toggle');

registerBtn.addEventListener('click', () => {
    container.classList.add("active");
});

loginBtn.addEventListener('click', () => {
    container.classList.remove("active");
});

// --- BACKEND ROUTING VIA WEB3FORMS ---
const form = document.getElementById('enquiryForm');
const statusText = document.getElementById('formStatus');
const submitBtn = document.getElementById('submitBtn');

form.addEventListener('submit', function(e) {
    e.preventDefault(); 
    
    // Lock submit button & show feedback loader text
    submitBtn.disabled = true;
    submitBtn.innerText = "Sending...";
    statusText.style.display = "block";
    statusText.style.color = "#444444";
    statusText.innerText = "Processing your enquiry safely...";

    // Parse elements to key/value objects natively
    const formData = new FormData(form);
    const object = Object.fromEntries(formData);
    const json = JSON.stringify(object);

    // POST request straight to Web3Forms API
    fetch('https://api.web3forms.com/submit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: json
        })
        .then(async (response) => {
            let res = await response.json();
            if (response.status == 200) {
                // Handle Success
                statusText.style.color = "#2e7d32"; 
                statusText.innerText = "Thank you! Enquiry sent successfully.";
                form.reset();
                
                // Slide the panels shut smoothly back to the start state after 2.5s
                setTimeout(() => {
                    container.classList.remove("active");
                    statusText.style.display = "none";
                }, 2500);
            } else {
                // API Validation Failures
                statusText.style.color = "#c62828";
                statusText.innerText = res.message || "Failed to process form attributes.";
            }
        })
        .catch(error => {
            // General Connection Loss Errors
            statusText.style.color = "#c62828";
            statusText.innerText = "Network translation error. Please try again later.";
            console.error(error);
        })
        .then(function() {
            // Re-enable UI components
            submitBtn.disabled = false;
            submitBtn.innerText = "Submit Request";
        });
});