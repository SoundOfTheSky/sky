import mqtt from 'mqtt';

import { getDataFromRequest, sendJSON } from '../../utils';
import { Capabilities, devices, DeviceState, deviceStates } from '../../devices';
import type { ApiHandler } from '..';
import { authCheck, PERMISSIONS } from '../../services/auth';

const [MQTT_ADDRESS, MQTT_USER, MQTT_PASSWORD] = process.env['MQTT']!.split(' ');
const MQTTClient = mqtt.connect(MQTT_ADDRESS!, {
  username: MQTT_USER,
  password: MQTT_PASSWORD,
});
/*[
  'close',
  'connect',
  'disconnect',
  'end',
  'error',
  'message',
  'offline',
  'outgoingEmpty',
  'packetreceive',
  'packetsend',
  'reconnect',
].forEach(e => MQTTClient.on(e, (...args: unknown[]) => log('MQTT', e, ...args)));*/
export default (async function (req, res, query) {
  if (query.pathname !== '/api/yandex-house/v1.0/user/devices/action') return;
  if (!authCheck(req, res, [PERMISSIONS.HOUSE])) {
    if (!res.headersSent && res.writable) res.writeHead(401).end();
    return;
  }
  const rawData = await getDataFromRequest(req);
  const data = rawData.toString();
  const reqBody = JSON.parse(data) as {
    request_id: string;
    payload: {
      devices: (DeviceState & { custom_data?: Record<string, string> })[];
    };
  };
  const resBody: {
    request_id: string;
    payload: {
      devices: { id: string; action_result: { status: 'DONE' } }[];
    };
  } = {
    request_id: req.headers['x-request-id'] as string,
    payload: {
      devices: [],
    },
  };
  for (const d of reqBody.payload.devices) {
    const device = devices.get(d.id)!;
    const deviceState = deviceStates.get(d.id)!;
    deviceState.capabilities = d.capabilities;
    for (const capability of d.capabilities) {
      if (capability.type === Capabilities.onOff && device.custom_data && 'MQTT' in device.custom_data)
        MQTTClient.publish(device.custom_data['MQTT']!, capability.state.value ? 'on' : 'off');
    }
    resBody.payload.devices.push({
      id: device.id,
      action_result: { status: 'DONE' },
    });
  }
  sendJSON(res, resBody);
} as ApiHandler);
