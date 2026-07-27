"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { createBase } from "../actions/create-base";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function CreateBaseForm() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [segment, setSegment] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setLoading(true);

    try {
      await createBase({
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
        <CardTitle>Nova Base</CardTitle>
      </CardHeader>

      <CardContent>
        <form
          onSubmit={handleSubmit}
          className="space-y-5"
        >
          <div className="space-y-2">
            <label>Nome</label>

            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Construtoras ES"
            />
          </div>

          <div className="space-y-2">
            <label>Descrição</label>

            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
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
            {loading ? "Salvando..." : "Criar Base"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}