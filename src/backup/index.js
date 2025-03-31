
function testAllConsoleTypes() {

 const usuario = { id: 123, nome: "Teste" };
 const config = { tema: "dark" };
 console.debug("Debug: Variáveis atuais", JSON.stringify({ usuario, config }, null, 2));
 // Console padrão
 console.log("Este é um LOG normal");

 // Console de informação
 console.info("Informação importante!", { detalhes: { versao: "1.0", autor: "Acode" } });

 // Console de aviso
 console.warn("Atenção: Isso é um aviso!", "Operação pode ser lenta");

 // Console de erro
 console.error("Erro crítico!", new Error("Falha na conexão"), { status: 500 });

 // Console de debug
 console.debug("Debug: Variáveis atuais", {
  usuario: { id: 123, nome: "Teste" },
  config: { tema: "dark" }
 });

 // Console com formatação especial
 console.log("%cEstilo customizado!",
  "color: #ff00ff; font-size: 10px; font-weight: bold;");
}

testAllConsoleTypes();

async function fetchTest() {
 const testCases = [
  {
   name: "JSONPlaceholder Post",
   url: "https://jsonplaceholder.typicode.com/posts/1",
   method: "GET"
  },
  {
   name: "JSONPlaceholder User",
   url: "https://jsonplaceholder.typicode.com/users/1",
   method: "GET"
  },
  {
   name: "ReqRes.in User",
   url: "https://reqres.in/api/users/2",
   method: "GET"
  },
  {
   name: "Dog API Random Image",
   url: "https://dog.ceo/api/breeds/image/random",
   method: "GET"
  },
  {
   name: "Random User",
   url: "https://randomuser.me/api/",
   method: "GET"
  },
  {
   name: "POST Test",
   url: "https://jsonplaceholder.typicode.com/posts",
   method: "POST",
   body: JSON.stringify({
    title: 'foo',
    body: 'bar',
    userId: 1
   }),
   headers: {
    'Content-type': 'application/json; charset=UTF-8'
   }
  }
 ];

 console.log("Starting fetch tests...");

 for (const test of testCases) {
  try {
   console.log(`Testing: ${test.name} (${test.method} ${test.url})`);

   const options = {
    method: test.method,
    headers: test.headers
   };

   if (test.body) {
    options.body = test.body;
   }

   const response = await fetch(test.url, options);

   if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
   }

   const data = await response.json();
   console.log(`Success: ${test.name}`, data);
  } catch (error) {
   console.error(`Error in ${test.name}:`, error.message);
  } finally {
   // Pequeno delay entre requisições para melhor visualização
   await new Promise(resolve => setTimeout(resolve, 500));
  }
 }

 console.log("All fetch tests completed");
}


//fetchTest();



