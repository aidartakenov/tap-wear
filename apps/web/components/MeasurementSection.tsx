'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Ruler, User } from 'lucide-react';

interface MeasurementSectionProps {
  bodyMeasurements: {
    chest?: number;
    waist?: number;
    hips?: number;
    shoulders?: number;
    sleeve?: number;
  };
  garmentMeasurements: {
    length: number;
    chest: number;
    waist: number;
    hips?: number;
    sleeve?: number;
  };
}

export function MeasurementSection({
  bodyMeasurements,
  garmentMeasurements,
}: MeasurementSectionProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="w-4 h-4" />
            Мерки тела
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {bodyMeasurements.chest && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Обхват груди</span>
              <span className="font-medium">{bodyMeasurements.chest} см</span>
            </div>
          )}
          {bodyMeasurements.waist && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Обхват талии</span>
              <span className="font-medium">{bodyMeasurements.waist} см</span>
            </div>
          )}
          {bodyMeasurements.hips && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Обхват бедер</span>
              <span className="font-medium">{bodyMeasurements.hips} см</span>
            </div>
          )}
          {bodyMeasurements.shoulders && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Ширина плеч</span>
              <span className="font-medium">{bodyMeasurements.shoulders} см</span>
            </div>
          )}
          {bodyMeasurements.sleeve && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Длина рукава</span>
              <span className="font-medium">{bodyMeasurements.sleeve} см</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Ruler className="w-4 h-4" />
            Замеры изделия
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Длина</span>
            <span className="font-medium">{garmentMeasurements.length} см</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Обхват груди изделия</span>
            <span className="font-medium">{garmentMeasurements.chest} см</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Обхват талии изделия</span>
            <span className="font-medium">{garmentMeasurements.waist} см</span>
          </div>
          {garmentMeasurements.hips && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Обхват бедер изделия</span>
              <span className="font-medium">{garmentMeasurements.hips} см</span>
            </div>
          )}
          {garmentMeasurements.sleeve && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Длина рукава изделия</span>
              <span className="font-medium">{garmentMeasurements.sleeve} см</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
