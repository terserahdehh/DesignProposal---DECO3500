// this screen presents a quick group signal before the shared confirmation flow.
import React from 'react';
import { View, Text } from 'react-native';
import Icon from '../components/Icon';
import base from './screenStyles';

export default function QuickSignalScreen({ option, scale }) {
  return <View style={base.center}>
    <Icon name={option.icon} size={34 * scale} stroke={2} />
    <Text style={[base.title, { fontSize: 21 * scale, lineHeight: 25 * scale }]}>{option.lines}</Text>
  </View>;
}
