"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { updateBase } from "../actions/update-base";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  base: {
    id: string;
    name: string;
    description: string | null;
    segment: string | null;
    state: string | null;
    city: string | null;
  };
};

export function EditBaseForm({ base }: Props) {
  const router = useRouter();

  const [loading, setLoading] = useState(false);

  const [name, setName] = useState(base.name);
  const [description, setDescription] = useState(base.description ?? "");
  const [segment, setSegment] = useState(base.segment ?? "");
  const [state, setState] = useState(base.state ?? "");
  const [city, setCity] = useState(base.city ?? "");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setLoading(true);

    try {
      await updateBase(base.id, {
        name,
        description,
        segment,
        state,
        city,
      });

      router.push("/bases");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>Editar Base</CardTitle>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label>Nome</label>

            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label>Descrição</label>

            <Textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <label>Segmento</label>

              <Input
                value={segment}
                onChange={(e) => setSegment(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label>Estado</label>

              <Input
                value={state}
                onChange={(e) => setState(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label>Cidade</label>

              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>
          </div>

          <Button
            className="w-full"
            disabled={loading}
          >
            {loading ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}