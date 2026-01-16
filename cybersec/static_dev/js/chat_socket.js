const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
const wsUrl = `${wsProtocol}://${window.location.host}/ws/user/`;
export const socket = new WebSocket(wsUrl);

socket.onopen = () => {
    console.log("WebSocket connected");
};

socket.onclose = (e) => {
    console.log("WebSocket closed. Reconnecting...", e.reason);
    setTimeout(() => location.reload(), 2000);
};

socket.onerror = (err) => {
    console.error("WebSocket error:", err);
};


export function sendWS(data) {
    socket.send(JSON.stringify(data));
}