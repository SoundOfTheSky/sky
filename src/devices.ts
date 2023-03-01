export enum DeviceTypes {
  light = 'devices.types.light',
  other = 'devices.types.other',
}
export enum Capabilities {
  onOff = 'devices.capabilities.on_off',
  range = 'devices.capabilities.range',
  color = 'devices.capabilities.color_setting',
}
export enum CapabilityInstances {
  on = 'on',
  hsv = 'hsv',
  rgb = 'rgb',
  scene = 'scene',
  brightness = 'brightness',
  temperatureK = 'temperature_k',
}
export type CapabilityOnOff = {
  type: Capabilities.onOff;
};
export type CapabilityRange = {
  type: Capabilities.range;
  parameters: {
    instance: 'brightness';
    random_access: true;
    range: {
      max: 100;
      min: 1;
      precision: 1;
    };
    unit: 'unit.percent';
  };
};
export type CapabilityColor = {
  type: Capabilities.color;
  parameters: {
    color_model: 'hsv';
    temperature_k: {
      max: 5600;
      min: 5600;
    };
  };
};
export type Capability = CapabilityOnOff | CapabilityRange | CapabilityColor;
export type Device = {
  id: string;
  name: string;
  type: DeviceTypes;
  room: string;
  capabilities: Capability[];
  custom_data?: Record<string, string>;
};
export type CapabilityStateOnOff = {
  type: Capabilities.onOff;
  state: {
    instance: CapabilityInstances.on;
    value: boolean;
  };
};
export type CapabilityStateColor = {
  type: Capabilities.color;
  state: {
    instance: CapabilityInstances.hsv;
    value: {
      h: number;
      s: number;
      v: number;
    };
  };
};
export type CapabilityStateRange = {
  type: Capabilities.range;
  state: {
    instance: CapabilityInstances.brightness;
    value: number;
  };
};
export type CapabilityState = CapabilityStateColor | CapabilityStateOnOff | CapabilityStateRange;
export type DeviceState = {
  id: string;
  capabilities: CapabilityState[];
};

let uuid = 0;
export function createDevice(options: {
  name: string;
  room: string;
  type: DeviceTypes;
  color?: boolean;
  brightness?: boolean;
  custom_data?: Record<string, string>;
}): Device {
  const device: Device = {
    id: `${++uuid}`,
    name: options.name,
    type: options.type,
    room: options.room,
    capabilities: [
      {
        type: Capabilities.onOff,
      },
    ],
  };
  if (options.custom_data) device.custom_data = options.custom_data;
  if (options.color)
    device.capabilities.push({
      type: Capabilities.color,
      parameters: {
        color_model: 'hsv',
        temperature_k: {
          max: 5600,
          min: 5600,
        },
      },
    });
  if (options.brightness)
    device.capabilities.push({
      type: Capabilities.range,
      parameters: {
        instance: 'brightness',
        random_access: true,
        range: {
          max: 100,
          min: 1,
          precision: 1,
        },
        unit: 'unit.percent',
      },
    });
  return device;
}
export const devices = new Map<string, Device>();

for (const d of [
  createDevice({
    name: 'Компьютер',
    room: 'Зал',
    type: DeviceTypes.other,
    custom_data: {
      MQTT: 'pc',
    },
  }),
  createDevice({
    name: 'Компьютер Ксюши',
    room: 'Комната Ксюши',
    type: DeviceTypes.other,
    custom_data: {
      MQTT: 'pc-ksusha',
    },
  }),
])
  devices.set(d.id, d);

export const deviceStates = new Map<string, DeviceState>();
// Create default device states
for (const device of devices.values())
  deviceStates.set(device.id, {
    id: device.id,
    capabilities: device.capabilities.map((capability) => ({
      type: capability.type,
      state: {
        instance:
          capability.type === Capabilities.color
            ? CapabilityInstances.hsv
            : capability.type === Capabilities.onOff
            ? CapabilityInstances.on
            : CapabilityInstances.brightness,
        value:
          capability.type === Capabilities.color
            ? {
                h: 0,
                s: 0,
                v: 100,
              }
            : capability.type === Capabilities.onOff
            ? false
            : 100,
      },
    })) as CapabilityState[],
  });
