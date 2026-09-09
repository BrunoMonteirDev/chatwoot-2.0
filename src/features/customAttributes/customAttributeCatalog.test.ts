// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CustomAttributeCatalog, customAttributeKeyFromName } from './customAttributeCatalog';

describe('custom attributes nativos',()=>{
  beforeEach(()=>vi.stubGlobal('fetch',vi.fn()));
  it.each([['Teste Prático','teste_pratico'],['Descrição do Imóvel','descricao_do_imovel'],['  Muitos   espaços!!! ','muitos_espacos']])('normaliza %s', (name,key)=>expect(customAttributeKeyFromName(name)).toBe(key));
  it('cacheia por account, separa contas e atualiza o cache no CRUD',async()=>{const dto={id:1,attribute_display_name:'Plano',attribute_key:'plano',attribute_display_type:'list',attribute_model:'contact_attribute',attribute_values:['A','B']};vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify([dto]),{status:200})).mockResolvedValueOnce(new Response(JSON.stringify({...dto,id:2,attribute_key:'contrato',attribute_display_name:'Contrato',attribute_model:'conversation_attribute'}),{status:200})).mockResolvedValueOnce(new Response(JSON.stringify([]),{status:200}));const catalog=new CustomAttributeCatalog();expect(await catalog.list(1)).toHaveLength(1);expect(await catalog.list(1)).toHaveLength(1);expect(fetch).toHaveBeenCalledTimes(1);await catalog.create(1,{name:'Contrato',key:'contrato',type:'list',model:'conversation_attribute',values:['A','B']});expect(catalog.peek(1)).toHaveLength(2);expect(await catalog.list(2)).toEqual([]);expect(fetch).toHaveBeenCalledTimes(3);});
  it('rejeita chave e opções inválidas antes da API',async()=>{const catalog=new CustomAttributeCatalog();await expect(catalog.create(1,{name:'X',key:'inválida-x',type:'text',model:'contact_attribute'})).rejects.toThrow('chave');await expect(catalog.create(1,{name:'X',key:'x',type:'list',model:'contact_attribute',values:[]})).rejects.toThrow('opção');expect(fetch).not.toHaveBeenCalled();});
});
