const params = new Proxy(new URLSearchParams(window.location.search), {
    get: (searchParams, prop) => searchParams.get(prop),
});
const code = params.inviteCode;
const codeInput = document.querySelector("#inviteCode");
if(code) {
    codeInput.value = code;
    codeInput.disabled = true;
}