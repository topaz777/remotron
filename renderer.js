const { ipcRenderer } = require('electron')
const os = require('os')
const diskspace = require('diskspace')

const onlineStatus = () => {
	let status = navigator.onLine ? 'online' : 'offline'
	console.log("NetworkStatus :", status)
	ipcRenderer.send('logging', "NetworkStatus : " + status);
}
window.addEventListener('online', onlineStatus)
window.addEventListener('offline', onlineStatus)

onlineStatus()

var save_btn = document.getElementById("save_btn");
var site_code = document.getElementById("site_code");
var floor_no = document.getElementById("floor_no");
var room_name = document.getElementById("room_name");
var device_name = document.getElementById("device_name");

diskspace.check('C', function (err, result) {
	console.log("남은디스크공간 :", (result.free/1024/1024/1024).toFixed(1) + " / " + (result.total/1024/1024/1024).toFixed(0) + " GB" + " | " + parseInt(result.free/result.total*100) + "%");
})
console.log("메모리사용량 :", (os.freemem()/1024/1024/1024).toFixed(1) + " / " + (os.totalmem()/1024/1024/1024).toFixed(1) + " GB");
console.log("프로세서 :", os.cpus()[0].model);
console.log("컴퓨터사용시간 :", parseInt(os.uptime()/60/60), "hours", parseInt(os.uptime()/60%60), "mins");
console.log("컴퓨터이름 :", os.hostname());
console.log("사용자계정 :", os.userInfo().username);
console.log("OS버전 :", os.version(), os.arch());

let ip = "0.0.0.0";
let networkInterfaces = os.networkInterfaces();
for (let name in networkInterfaces) {
	for (let networkInterface of networkInterfaces[name]) {
    	if(networkInterface.family == "IPv4" && networkInterface.address != "127.0.0.1") {
        	ip = networkInterface.address;
          break;
        }
    }
}
console.log("아이피 :", ip);

// save_btn.addEventListener("click", )

function save_info() {
	window.localStorage.setItem("site_code", site_code.value);
	window.localStorage.setItem("floor_no", floor_no.value);
	window.localStorage.setItem("room_name", room_name.value);
	window.localStorage.setItem("device_name", device_name.value);
}
